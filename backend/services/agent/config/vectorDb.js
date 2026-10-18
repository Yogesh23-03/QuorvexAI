import { QdrantVectorStore } from "@langchain/qdrant";
import { getEmbeddings } from "./embeddings.js";
import { ApiError } from "../../../shared/errors.js";

export function collectionName(userId, conversationId) {
  const safeUser = String(userId || "anon")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
  const safeConversation = String(conversationId || Date.now())
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8);
  return `pdf_${safeUser}_${safeConversation}`;
}

export async function createVectorStore(docs, name) {
  if (!process.env.QDRANT_URL) {
    throw new ApiError(503, "Document search is not configured", "VECTOR_DB_NOT_CONFIGURED");
  }

  return QdrantVectorStore.fromDocuments(docs, getEmbeddings(), {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: name,
  });
}
