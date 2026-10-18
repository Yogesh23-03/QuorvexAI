import api from "../lib/api";

export async function listConversations() {
  const { data } = await api.get("/api/chat/get-conversations");
  return Array.isArray(data) ? data : [];
}

export async function createConversation() {
  const { data } = await api.post("/api/chat/create-conversation");
  return data;
}

export async function renameConversation({ id, title }) {
  const { data } = await api.post("/api/chat/update-conversation", { id, title });
  return data;
}

export async function deleteConversation(id) {
  const { data } = await api.delete(`/api/chat/conversations/${id}`);
  return data;
}

export async function fetchMessages(conversationId) {
  const { data } = await api.get(`/api/chat/get-messages/${conversationId}`);
  return Array.isArray(data) ? data : [];
}
