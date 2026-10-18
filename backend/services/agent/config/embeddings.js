import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ApiError } from "../../../shared/errors.js";

let embeddings = null;

export function getEmbeddings() {
  if (embeddings) return embeddings;
  if (!process.env.GOOGLE_API_KEY) {
    throw new ApiError(503, "Document embeddings are not configured", "EMBEDDINGS_NOT_CONFIGURED");
  }
  embeddings = new GoogleGenerativeAIEmbeddings({
    model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
    apiKey: process.env.GOOGLE_API_KEY,
  });
  return embeddings;
}

export default getEmbeddings;
