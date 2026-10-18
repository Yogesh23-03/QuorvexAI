import axios from "axios";
import { serviceUrl } from "../config/services.js";
import { logger } from "../../../shared/logger.js";

function client() {
  return axios.create({
    baseURL: serviceUrl("CHAT_SERVICE"),
    timeout: 15000,
    headers: process.env.INTERNAL_API_KEY ? { "x-internal-key": process.env.INTERNAL_API_KEY } : {},
  });
}

export async function saveMessage(userId, payload) {
  try {
    const { data } = await client().post("/save-message", payload, {
      headers: { "x-user-id": String(userId) },
    });
    return data;
  } catch (error) {
    logger.error({ err: error.message }, "failed to persist message to chat service");
    return null;
  }
}

export async function getMessages(conversationId, userId) {
  if (!userId) return [];
  try {
    const { data } = await client().get(`/get-messages/${conversationId}`, {
      headers: { "x-user-id": String(userId) },
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error({ err: error.message }, "failed to load history from chat service");
    return [];
  }
}
