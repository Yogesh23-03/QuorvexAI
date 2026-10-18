export const AGENT_COSTS = Object.freeze({
  chat: 1,
  search: 5,
  coding: 10,
  pdf: 10,
  ppt: 10,
  vision: 10,
  imageAnalyzer: 10,
  pdfRag: 10,
});

export const AGENT_LIMITS = Object.freeze({
  chat: 20,
  search: 5,
  coding: 5,
  pdf: 5,
  ppt: 5,
  vision: 5,
  imageAnalyzer: 5,
  pdfRag: 5,
});

export const PLANS = Object.freeze({
  free: { id: "free", name: "Free", amount: 0, credits: 100, validity: 30 },
  starter: { id: "starter", name: "Starter", amount: 199, credits: 500, validity: 30 },
  pro: { id: "pro", name: "Pro", amount: 499, credits: 1000, validity: 30 },
});

const ALLOWED_AGENTS = Object.freeze([
  "auto",
  "chat",
  "search",
  "coding",
  "pdf",
  "ppt",
  "vision",
  "imageAnalyzer",
  "pdfRag",
]);

export const normalizeAgent = (agent) => {
  if (!agent) return "auto";
  const value = String(agent).trim();
  const match = ALLOWED_AGENTS.find((item) => item.toLowerCase() === value.toLowerCase());
  return match || "auto";
};
