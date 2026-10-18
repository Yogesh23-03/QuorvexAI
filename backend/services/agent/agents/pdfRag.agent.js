import fs from "fs/promises";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createVectorStore, collectionName } from "../config/vectorDb.js";
import { getModel, extractText } from "../config/llmModel.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const SYSTEM = `You are the QuorvexAI document assistant.

Rules:
- Answer ONLY from the uploaded document context.
- Never invent information.
- If the answer is not in the document, reply exactly:
"I couldn't find this information in the uploaded PDF."
- Use Markdown formatting.`;

async function extractPdfText(buffer) {
  const mod = await import("pdf-parse");

  // pdf-parse v2 exposes a PDFParse class; v1 exports a callable.
  if (typeof mod.PDFParse === "function") {
    const parser = new mod.PDFParse({ data: buffer });
    const result = await parser.getText();
    return result?.text || "";
  }

  const legacy = mod.default || mod;
  if (typeof legacy === "function") {
    const result = await legacy(buffer);
    return result?.text || "";
  }

  throw new ApiError(500, "PDF parsing library is unavailable", "PDF_PARSER_MISSING");
}

export async function pdfRag(state) {
  if (!state.file?.path) {
    throw new ApiError(400, "A PDF upload is required for this agent", "FILE_REQUIRED");
  }

  try {
    const buffer = await fs.readFile(state.file.path);
    const text = await extractPdfText(buffer);

    if (!text || text.trim().length < 20) {
      throw new ApiError(422, "I couldn't read any text from that PDF", "EMPTY_PDF");
    }

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments([text]);

    const store = await createVectorStore(docs, collectionName(state.userId, state.conversationId));
    const relevant = await store.similaritySearch(state.prompt, 5);
    const context = relevant.map((doc) => doc.pageContent).join("\n\n");

    const response = await getModel("pdf-rag").invoke([
      new SystemMessage(SYSTEM),
      new HumanMessage(`Context:\n${context}\n\nQuestion:\n${state.prompt}`),
    ]);

    const answer = extractText(response);
    if (!answer)
      throw new ApiError(502, "The model returned an empty response", "EMPTY_MODEL_RESPONSE");

    return { ...state, aiResponse: answer };
  } catch (error) {
    logger.error({ err: error.message }, "pdf rag agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Document analysis failed. Please try again.", "PDF_RAG_FAILED");
  }
}
