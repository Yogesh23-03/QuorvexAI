import fs from "fs/promises";
import { graph } from "../graph/graph.js";
import { resolveAgent } from "../graph/router.js";
import { addMessage } from "../config/memory.js";
import { checkAgentLimit } from "../config/agentLimit.js";
import { deductCredits, refundCredits } from "../utils/credits.js";
import { saveMessage } from "../utils/chatClient.js";
import { fetchUser } from "../utils/userClient.js";
import { withTimeout } from "../utils/withTimeout.js";
import { badRequest, unauthorized } from "../../../shared/errors.js";
import { normalizeAgent } from "../../../shared/constants.js";
import { logger } from "../../../shared/logger.js";
import { beginKeepAlive, sendJson } from "../../../shared/stream.js";

const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 180000);
const FAILURE_MESSAGE = "The agents could not answer that. Please try again.";

async function cleanupFile(file) {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT")
      logger.warn({ err: error.message }, "failed to remove temp upload");
  }
}

/** Client-safe text: 4xx messages are already written for the caller. */
function safeMessage(error) {
  if (error?.expose === true || (Number(error?.status) || 500) < 500) return error.message;
  return FAILURE_MESSAGE;
}

export async function agent(req, res, next) {
  const file = req.file;
  const userId = req.headers["x-user-id"];
  // Only set once credits are actually reserved, so a failed charge is never refunded.
  let chargedAgent = null;
  let keepAlive = { started: false, stop() {} };

  try {
    if (!userId) throw unauthorized();

    const { prompt, conversationId } = req.body || {};
    if (typeof prompt !== "string" || !prompt.trim()) throw badRequest("A message is required");
    if (!conversationId) throw badRequest("conversationId is required");

    const requestedAgent = normalizeAgent(req.body?.agent);
    const agentName = await resolveAgent({ prompt, agent: requestedAgent, file });

    // One charge per request, reserved up-front, then released if the run fails.
    await deductCredits(userId, agentName);
    chargedAgent = agentName;
    await checkAgentLimit(userId, chargedAgent);

    // Everything above fails fast with a real status (401/402/429). From here on
    // the run can outlive CloudFront's 30s and the ALB's 60s, so the response
    // head goes out now and newline heartbeats keep it alive.
    keepAlive = beginKeepAlive(res);

    const result = await withTimeout(
      graph.invoke({ prompt, conversationId, agent: agentName, userId, file }),
      AGENT_TIMEOUT_MS,
      "The agents are busy right now. Please try again in a moment.",
    );

    await saveMessage(userId, { conversationId, role: "user", content: prompt });
    await addMessage(conversationId, "user", prompt);

    const answer = result?.aiResponse || "";
    await addMessage(conversationId, "assistant", answer);
    await saveMessage(userId, {
      conversationId,
      role: "assistant",
      content: answer,
      images: result?.images,
      artifacts: result?.artifacts,
    });

    const user = await fetchUser(userId);
    await cleanupFile(file);

    return sendJson(res, 200, {
      answer,
      images: result?.images || [],
      artifacts: result?.artifacts || [],
      agent: agentName,
      credits: user?.credits,
      totalCredits: user?.totalCredits,
    });
  } catch (error) {
    if (chargedAgent && userId) await refundCredits(userId, chargedAgent);
    await cleanupFile(file);

    // The head is already on the wire, so the failure travels in the body. The
    // frontend maps `success:false` back to the same error it would have shown
    // for a 4xx/5xx response.
    if (res.headersSent) {
      logger.error({ err: error.message, code: error.code }, "agent run failed after headers sent");
      sendJson(res, 200, {
        success: false,
        error: { code: error.code || "AGENT_FAILED", message: safeMessage(error) },
        requestId: req.id,
      });
      return undefined;
    }

    return next(error);
  } finally {
    keepAlive.stop();
  }
}
