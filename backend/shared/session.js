import redis from "./redis/redis.js";

/**
 * Redis keys shared by the services that still read the auth session and by
 * the agent's short-term message memory.
 */
const sessionKey = (sessionId) => `session-${sessionId}`;

export const messagesKey = (conversationId) => `messages-${conversationId}`;

/**
 * Legacy Redis sessions created before the JWT rollout. The gateway still
 * honours them until they expire; nothing creates new ones.
 */
export async function readSession(sessionId) {
  if (!sessionId) return null;
  const raw = await redis.get(sessionKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
