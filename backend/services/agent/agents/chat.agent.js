import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel, extractText } from "../config/llmModel.js";
import { getMemory } from "../config/memory.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const SYSTEM_PROMPT = `You are QuorvexAI, an intelligent multi-agent assistant.

Rules:
- Speak naturally and confidently, like a expert teammate.
- For simple questions, greetings, and short queries, answer in plain text.
- For technical, educational, or detailed topics use clean Markdown.
- Use # for titles and ## for sections, always with a blank line after headings.
- Never put a heading and its content on the same line.
- Prefer short paragraphs and bullet lists over walls of text.
- Wrap code in fenced blocks with a language tag.
- Never mention internal tools, models, or routing.`;

function searchContext(results) {
  if (!results) return "";
  const payload = typeof results === "string" ? results : JSON.stringify(results).slice(0, 6000);
  return `\n\nWeb search results (use these to answer, and cite nothing else):\n${payload}`;
}

export async function chatAgent(state) {
  try {
    const llm = getModel("chat");
    const history = await getMemory(state.conversationId, state.userId);

    const messages = [new SystemMessage(SYSTEM_PROMPT + searchContext(state.searchResults))];
    history.forEach((message) => {
      if (message.role === "user") messages.push(new HumanMessage(message.content));
      if (message.role === "assistant") messages.push(new AIMessage(message.content));
    });
    messages.push(new HumanMessage(state.prompt));

    const response = await llm.invoke(messages);
    const text = extractText(response);
    if (!text)
      throw new ApiError(502, "The model returned an empty response", "EMPTY_MODEL_RESPONSE");

    return { ...state, aiResponse: text };
  } catch (error) {
    logger.error({ err: error.message }, "chat agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Chat is unavailable right now. Please try again.", "CHAT_FAILED");
  }
}
