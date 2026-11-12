import api, { ApiRequestError } from "../lib/api";

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

  // Long runs answer with a 200 head and heartbeat newlines, so a failure that
  // happens after the run starts arrives in the body instead of the status.
  // Translate it back into the error shape every screen already handles.
  if (data && data.success === false) {
    throw new ApiRequestError({
      message: data.error?.message || "The agents could not answer that. Please try again.",
      code: data.error?.code || "AGENT_FAILED",
      status: 200,
      requestId: data.requestId,
    });
  }

  return {
    answer: data?.answer || "",
    images: Array.isArray(data?.images) ? data.images : [],
    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
    agent: data?.agent,
    credits: data?.credits,
    totalCredits: data?.totalCredits,
  };
}
