import axios from "axios";
import { getModel, extractText } from "../config/llmModel.js";
import { getFromS3, uploadToS3, SIGNED_URL_TTL_SECONDS } from "../utils/s3Files.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const PROMPT = (request) => `You are an elite AI image prompt engineer.

Convert the user request into one highly detailed image generation prompt.

Requirements: cinematic lighting, professional composition, ultra realistic, high detail,
beautiful colour palette, sharp focus, photographic depth of field, 8K quality.

Return only the image prompt, with no preamble.

User request:
${request}`;

export async function visionAgent(state) {
  try {
    const response = await getModel("image").invoke(PROMPT(state.prompt));
    const prompt = extractText(response).trim();
    if (!prompt) throw new ApiError(502, "Could not build an image prompt", "BAD_IMAGE_PROMPT");

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;

    const imageRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: Number(process.env.IMAGE_TIMEOUT_MS || 90000),
      maxContentLength: 20 * 1024 * 1024,
    });

    const contentType = imageRes.headers?.["content-type"] || "image/png";
    if (!contentType.startsWith("image/")) {
      throw new ApiError(
        502,
        "The image service returned an unexpected response",
        "IMAGE_PROVIDER_ERROR",
      );
    }

    const buffer = Buffer.from(imageRes.data);
    if (buffer.length < 1024) {
      throw new ApiError(502, "The image service returned an empty image", "IMAGE_PROVIDER_ERROR");
    }

    const extension = contentType.includes("jpeg") ? "jpg" : "png";
    const filename = `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    await uploadToS3(filename, buffer, contentType);
    const downloadUrl = await getFromS3(filename);

    const minutes = Math.round(SIGNED_URL_TTL_SECONDS / 60);

    return {
      ...state,
      images: [downloadUrl],
      aiResponse: `## Image ready

The generated image is attached below.

_Link expires in ${minutes} minutes._`,
      artifacts: [
        {
          id: `image-${Date.now()}`,
          type: "image",
          title: state.prompt.slice(0, 80),
          fileName: filename,
          url: downloadUrl,
          size: buffer.length,
        },
      ],
    };
  } catch (error) {
    logger.error({ err: error.message }, "vision agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Image generation failed. Please try again.", "IMAGE_FAILED");
  }
}
