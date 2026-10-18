import { getModel, extractText } from "../config/llmModel.js";
import { parseJsonLoose, normalizeArtifact } from "../utils/json.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

const INTENTS = [
  "CODE_GENERATION",
  "CODE_REVIEW",
  "CODE_EXPLANATION",
  "DEBUGGING",
  "OPTIMIZATION",
  "CONVERSION",
  "DOCUMENTATION",
];

async function classifyIntent(prompt) {
  try {
    const response = await getModel("intent").invoke(
      `You are an intent classifier. Return ONLY one of these values:\n${INTENTS.join("\n")}\n\nUser request:\n${prompt}`,
    );
    const raw = extractText(response).trim().toUpperCase();
    return INTENTS.find((intent) => raw.includes(intent)) || "CODE_EXPLANATION";
  } catch (error) {
    logger.warn({ err: error.message }, "intent classification failed, defaulting");
    return "CODE_EXPLANATION";
  }
}

const PROJECT_PROMPT = (
  prompt,
) => `You are the QuorvexAI Coding Agent. Build exactly what the user asks for.

CHOOSE THE FORMAT FROM THE REQUEST:
- Web page / UI / game / calculator / dashboard / landing page -> type "web" with a runnable index.html plus any CSS/JS files.
- Python, Node, a CLI, an algorithm, a data script -> type "code" and emit the source files only. No HTML wrapper.
- Single-file React (browser preview) -> type "web" with an index.html that loads React from a CDN.
Never force index.html/style.css/script.js onto a request that is not a web page.

HARD REQUIREMENTS FOR WEB PROJECTS:
- index.html links the CSS (<link rel="stylesheet" href="style.css">) and the JS (<script src="script.js" defer></script>).
- Every element id/class referenced by JavaScript exists in the HTML.
- Event listeners are attached inside DOMContentLoaded (or use defer), never before the DOM exists.
- The app must actually work: buttons update state/display, forms validate, games track turns and wins.
- No external network dependencies except well-known CDNs (unpkg, jsdelivr, cdnjs). No placeholder image services.
- Responsive layout with CSS variables, flex/grid and readable contrast.

Return ONLY valid JSON, no markdown fences, no commentary:
{
  "title": "short human title",
  "type": "web" | "code",
  "language": "html" | "python" | "javascript" | ...,
  "files": [{ "name": "index.html", "content": "..." }]
}

Start with { and end with }.

User request:
${prompt}`;

const REPAIR_PROMPT = (prompt, previous) => `Your previous answer was not valid project JSON.

Fix it and return ONLY the JSON object with this shape:
{"title":"...","type":"web"|"code","language":"...","files":[{"name":"...","content":"..."}]}

Rules: no markdown fences, escape newlines inside content, every file needs a name and content,
web projects need a runnable index.html and complete working JavaScript.

User request:
${prompt}

Previous answer (truncated):
${String(previous).slice(0, 5000)}`;

const REVIEW_PROMPT = (intent, prompt) => `A coding task was classified as: ${intent}

Return Markdown only. Never generate project files.

Use these sections where relevant:
# Overview
## Explanation
## Problems
## Improvements
## Best Practices
## Optimized Code

User request:
${prompt}`;

async function generateProject(llm, prompt) {
  const first = extractText(await llm.invoke(PROJECT_PROMPT(prompt)));
  let artifact = normalizeArtifact(parseJsonLoose(first), prompt);
  if (artifact) return artifact;

  // One repair round is enough for almost every malformed answer.
  logger.warn("coding agent returned invalid JSON, retrying with a repair prompt");
  const repaired = extractText(await llm.invoke(REPAIR_PROMPT(prompt, first)));
  artifact = normalizeArtifact(parseJsonLoose(repaired), prompt);
  return artifact;
}

function summary(artifact) {
  const list = artifact.files.map((file) => `- \`${file.name}\``).join("\n");
  return `### ${artifact.title}\n\n${artifact.files.length} file${
    artifact.files.length > 1 ? "s" : ""
  } ready. Use the artifact card to open the sandbox or download a .zip.\n\n${list}`;
}

export async function codingAgent(state) {
  try {
    const llm = getModel("coding");
    const intent = await classifyIntent(state.prompt);

    if (intent === "CODE_GENERATION") {
      const artifact = await generateProject(llm, state.prompt);

      if (!artifact) {
        return {
          ...state,
          aiResponse:
            "I could not produce a complete, runnable project this time — the model returned malformed files. Try rephrasing the request, or ask for a smaller first version.",
          artifacts: [],
        };
      }

      return {
        ...state,
        aiResponse: summary(artifact),
        artifacts: [
          {
            id: `${Date.now()}`,
            type: artifact.type,
            title: artifact.title,
            language: artifact.language,
            files: artifact.files,
          },
        ],
      };
    }

    const response = await llm.invoke(REVIEW_PROMPT(intent, state.prompt));
    const text = extractText(response);
    if (!text)
      throw new ApiError(
        502,
        "The coding model returned an empty response",
        "EMPTY_MODEL_RESPONSE",
      );

    return { ...state, aiResponse: text, artifacts: [] };
  } catch (error) {
    logger.error({ err: error.message }, "coding agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "The coding agent failed. Please try again.", "CODING_FAILED");
  }
}
