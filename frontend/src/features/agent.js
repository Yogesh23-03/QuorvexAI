import api from "../lib/api";

/**
 * Runs one agent turn. Multipart so PDF/image uploads stream alongside the
 * prompt; the response carries the answer, artifacts and the fresh balance.
 */
export async function runAgent({ prompt, conversationId, agent, file }) {
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("conversationId", conversationId);
  formData.append("agent", agent);
  if (file) formData.append("file", file);

  const { data } = await api.post("/api/agent/chat", formData);
  return {
    answer: data?.answer || "",
    images: Array.isArray(data?.images) ? data.images : [],
    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
    agent: data?.agent,
    credits: data?.credits,
    totalCredits: data?.totalCredits,
  };
}
