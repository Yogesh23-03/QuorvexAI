import fs from "fs/promises";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel, extractText } from "../config/llmModel.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const SYSTEM = `You are the QuorvexAI vision analyst.

Rules:
- Analyse only the uploaded image.
- Answer the user's question accurately.
- Extract any text that appears in the image.
- Explain charts and tables when present.
- Say so when something is unclear.
- Never invent details you cannot see.
- Use Markdown when helpful.`;

export async function imageAnalyzer(state) {
  if (!state.file?.path) {
    throw new ApiError(400, "An image upload is required for this agent", "FILE_REQUIRED");
  }

  try {
    const buffer = await fs.readFile(state.file.path);
    const base64Image = buffer.toString("base64");

    const messages = [
      new SystemMessage(SYSTEM),
      new HumanMessage({
        content: [
          { type: "text", text: state.prompt || "Analyse this image." },
          {
            type: "image_url",
            image_url: { url: `data:${state.file.mimetype};base64,${base64Image}` },
          },
        ],
      }),
    ];

    const response = await getModel("imageAnalyzer").invoke(messages);
    const text = extractText(response);
    if (!text)
      throw new ApiError(
        502,
        "The vision model returned an empty response",
        "EMPTY_MODEL_RESPONSE",
      );

    return { ...state, aiResponse: text };
  } catch (error) {
    logger.error({ err: error.message }, "image analyzer failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Image analysis failed. Please try again.", "IMAGE_ANALYSIS_FAILED");
  }
}
