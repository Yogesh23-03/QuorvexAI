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

const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 180000);

async function cleanupFile(file) {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT")
      logger.warn({ err: error.message }, "failed to remove temp upload");
  }
}

export async function agent(req, res, next) {
  const file = req.file;
  const userId = req.headers["x-user-id"];
  // Only set once credits are actually reserved, so a failed charge is never refunded.
  let chargedAgent = null;

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

    return res.status(200).json({
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
    // The shared error handler returns 5xx errors as a generic message, so raw
    // provider failures can pass through without leaking internals.
    return next(error);
  }
}
