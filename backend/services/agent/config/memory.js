import redis from "../../../shared/redis/redis.js";
import { messagesKey } from "../../../shared/session.js";
import { getMessages } from "../utils/chatClient.js";
import { logger } from "../../../shared/logger.js";

const MEMORY_TTL_SECONDS = 24 * 60 * 60;
const MAX_MESSAGES = 20;

const trim = (messages) =>
  messages
    .filter((message) => message?.role && typeof message.content === "string")
    .slice(-MAX_MESSAGES)
    .map(({ role, content }) => ({ role, content }));

export async function getMemory(conversationId, userId) {
  if (!conversationId) return [];
  const key = messagesKey(conversationId);

  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      logger.warn({ conversationId }, "corrupt conversation memory, rebuilding from chat service");
    }
  }

  const messages = trim(await getMessages(conversationId, userId));
  await redis.set(key, JSON.stringify(messages), "EX", MEMORY_TTL_SECONDS);
  return messages;
}

export async function addMessage(conversationId, role, content) {
  if (!conversationId || !content) return;
  const key = messagesKey(conversationId);

  const raw = await redis.get(key);
  let messages = [];
  if (raw) {
    try {
      messages = JSON.parse(raw);
    } catch {
      messages = [];
    }
  }

  messages.push({ role, content });
  while (messages.length > MAX_MESSAGES) messages.shift();

  await redis.set(key, JSON.stringify(messages), "EX", MEMORY_TTL_SECONDS);
}
