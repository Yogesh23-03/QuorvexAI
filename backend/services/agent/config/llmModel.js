import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";
import { ApiError } from "../../../shared/errors.js";

const cache = new Map();

function requireKey(name) {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(
      503,
      `${name} is not configured on the agent service`,
      "PROVIDER_NOT_CONFIGURED",
    );
  }
  return value;
}

function build(provider) {
  switch (provider) {
    case "groq":
      return new ChatGroq({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        apiKey: requireKey("GROQ_API_KEY"),
        temperature: 0.5,
        maxRetries: 2,
        timeout: Number(process.env.LLM_TIMEOUT_MS || 60000),
      });
    case "gemini":
      return new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        apiKey: requireKey("GOOGLE_API_KEY"),
        temperature: 0.4,
        maxRetries: 2,
      });
    case "openrouter":
      return new ChatOpenRouter({
        model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
        apiKey: requireKey("OPENROUTER_API_KEY"),
        temperature: 0,
        maxTokens: 4000,
        maxRetries: 2,
      });
    default:
      throw new ApiError(400, `Unknown model provider: ${provider}`, "BAD_REQUEST");
  }
}

const PROVIDERS = {
  router: "groq",
  intent: "groq",
  chat: "groq",
  search: "groq",
  coding: "openrouter",
  pdf: "groq",
  "pdf-rag": "groq",
  ppt: "groq",
  imageAnalyzer: "gemini",
  image: "groq",
};

export function getModel(agent = "chat") {
  const provider = PROVIDERS[agent];
  if (!provider) throw new ApiError(400, `Unknown agent model: ${agent}`, "BAD_REQUEST");
  if (!cache.has(provider)) cache.set(provider, build(provider));
  return cache.get(provider);
}

/** Normalises provider responses (some return content blocks) into plain text. */
export function extractText(response) {
  const content = response?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block === "string" ? block : block?.text || ""))
      .join("")
      .trim();
  }
  return "";
}
