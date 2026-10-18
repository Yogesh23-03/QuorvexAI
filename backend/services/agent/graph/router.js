import { getModel, extractText } from "../config/llmModel.js";
import { logger } from "../../../shared/logger.js";

export const ROUTABLE_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "vision"];

const PROMPT = (query) => `You are an agent router. Choose exactly one agent for the user query.

Available agents and when to use them:
- chat: general conversation, explanations, learning, questions
- search: current events, latest information, news, recent developments
- coding: generate code, debug code, build projects, architecture, API design
- pdf: the user wants a PDF document generated
- ppt: the user wants a presentation or slide deck generated
- vision: the user wants an image generated

Reply with ONLY one word, exactly one of: chat, search, coding, pdf, ppt, vision

User query:
${query}`;

/** Resolves the agent for a request. Never throws: falls back to chat. */
export async function resolveAgent(state) {
  const requested = String(state?.agent || "auto").trim();

  if (requested && requested.toLowerCase() !== "auto") {
    const match = [...ROUTABLE_AGENTS, "pdfRag", "imageAnalyzer"].find(
      (agent) => agent.toLowerCase() === requested.toLowerCase(),
    );
    if (match) return match;
  }

  const mime = state?.file?.mimetype || "";
  if (mime === "application/pdf") return "pdfRag";
  if (mime.startsWith("image/")) return "imageAnalyzer";

  try {
    const response = await getModel("router").invoke(PROMPT(state.prompt));
    const cleaned = extractText(response)
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    const exact = ROUTABLE_AGENTS.find((agent) => agent === cleaned);
    if (exact) return exact;

    const partial = ROUTABLE_AGENTS.find((agent) => cleaned.includes(agent));
    if (partial) return partial;

    logger.warn({ cleaned }, "router returned an unknown agent, defaulting to chat");
    return "chat";
  } catch (error) {
    logger.warn({ err: error.message }, "router model unavailable, defaulting to chat");
    return "chat";
  }
}

export async function router(state) {
  return { ...state, agent: await resolveAgent(state) };
}

export default router;
