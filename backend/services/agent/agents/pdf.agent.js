import { getModel, extractText } from "../config/llmModel.js";
import { buildPdf } from "../utils/generatePdf.js";
import { getFromS3, uploadToS3, SIGNED_URL_TTL_SECONDS } from "../utils/s3Files.js";
import { parseJsonLoose } from "../utils/json.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const PROMPT = (topic) => `You are an expert document writer.

Return ONLY valid JSON. No markdown, no explanation.

Shape:
{
  "title": "",
  "subtitle": "",
  "sections": [
    { "heading": "", "points": ["", ""] }
  ]
}

Generate 4-8 sections. Each section needs 3-6 concise bullet points.

Topic:
${topic}`;

export async function pdfAgent(state) {
  try {
    const response = await getModel("pdf").invoke(PROMPT(state.prompt));
    const data = parseJsonLoose(extractText(response));

    if (!data || !Array.isArray(data.sections) || data.sections.length === 0) {
      throw new ApiError(
        502,
        "Could not structure that document. Try rephrasing the topic.",
        "BAD_DOCUMENT_JSON",
      );
    }

    const buffer = await buildPdf(data);
    const filename = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    await uploadToS3(filename, buffer, "application/pdf");
    const downloadUrl = await getFromS3(filename);

    const minutes = Math.round(SIGNED_URL_TTL_SECONDS / 60);

    return {
      ...state,
      aiResponse: `## PDF ready

**${data.title}**

Your document is ready to download or preview.

_Link expires in ${minutes} minutes._`,
      artifacts: [
        {
          id: `pdf-${Date.now()}`,
          type: "pdf",
          title: data.title || state.prompt.slice(0, 80),
          fileName: data.title ? `${data.title}.pdf` : filename,
          url: downloadUrl,
          size: buffer.length,
        },
      ],
    };
  } catch (error) {
    logger.error({ err: error.message }, "pdf agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "PDF generation failed. Please try again.", "PDF_FAILED");
  }
}
