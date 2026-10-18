import { getModel, extractText } from "../config/llmModel.js";
import { generatePpt } from "../utils/generatePpt.js";
import { getFromS3, uploadToS3, SIGNED_URL_TTL_SECONDS } from "../utils/s3Files.js";
import { parseJsonLoose } from "../utils/json.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const PROMPT = (topic) => `You are a professional presentation designer.

Return ONLY valid JSON using this shape:
{
  "title": "",
  "subtitle": "",
  "slides": [
    { "title": "", "points": ["", "", "", ""] }
  ]
}

Rules:
- Exactly 6 content slides
- 4-6 concise bullet points per slide
- No markdown, no explanation, no code fences

Topic:
${topic}`;

export async function pptAgent(state) {
  try {
    const response = await getModel("ppt").invoke(PROMPT(state.prompt));
    const data = parseJsonLoose(extractText(response));

    if (!data || !Array.isArray(data.slides) || data.slides.length === 0) {
      throw new ApiError(
        502,
        "Could not structure that deck. Try rephrasing the topic.",
        "BAD_DECK_JSON",
      );
    }

    const ppt = generatePpt(data);
    const buffer = await ppt.write({ outputType: "nodebuffer" });

    const filename = `ppt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pptx`;
    await uploadToS3(
      filename,
      buffer,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    const downloadUrl = await getFromS3(filename);

    const minutes = Math.round(SIGNED_URL_TTL_SECONDS / 60);

    return {
      ...state,
      aiResponse: `## Presentation ready

**${data.title}**

${data.slides.length} slides are ready to download.

_Link expires in ${minutes} minutes._`,
      artifacts: [
        {
          id: `ppt-${Date.now()}`,
          type: "ppt",
          title: data.title || state.prompt.slice(0, 80),
          fileName: filename,
          url: downloadUrl,
          slides: data.slides.length,
          size: buffer.length,
        },
      ],
    };
  } catch (error) {
    logger.error({ err: error.message }, "ppt agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Presentation generation failed. Please try again.", "PPT_FAILED");
  }
}
