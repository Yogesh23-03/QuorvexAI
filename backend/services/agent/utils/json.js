/**
 * LLMs wrap JSON in prose or fences more often than you would like.
 * Returns null instead of throwing so callers can send a friendly message.
 */
export function parseJsonLoose(raw) {
  if (typeof raw !== "string") return null;

  let text = raw.trim();
  if (!text) return null;

  // Strip ```json ... ``` fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    try {
      // Common LLM mistakes: trailing commas and smart quotes around keys.
      const repaired = text
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

export function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file && typeof file.name === "string" && typeof file.content === "string")
    .map((file) => ({
      name: file.name.replace(/^[./\\]+/, "").slice(0, 120),
      content: file.content,
    }))
    .filter((file) => file.name.length > 0)
    .slice(0, 30);
}

const basename = (value = "") => String(value).split(/[?#]/)[0].split(/[\\/]/).pop().toLowerCase();

function detectLanguage(fileName = "") {
  const name = String(fileName).toLowerCase();
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".jsx")) return "jsx";
  if (name.endsWith(".js") || name.endsWith(".mjs")) return "javascript";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".java")) return "java";
  if (name.endsWith(".go")) return "go";
  if (name.endsWith(".rb")) return "ruby";
  if (name.endsWith(".php")) return "php";
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".sh")) return "bash";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".sql")) return "sql";
  return "plaintext";
}

const isRemote = (url = "") => /^(https?:)?\/\//i.test(url) || url.startsWith("data:");

/**
 * A generated HTML file that points at `style.css`/`script.js` files the model
 * forgot to emit produces a broken preview. Strip those dangling tags instead
 * of shipping a dead link.
 */
function dropDanglingReferences(files) {
  const html = files.find((file) => /\.html?$/i.test(file.name));
  if (!html) return files;

  const names = new Set(files.map((file) => basename(file.name)));
  let content = html.content;

  content = content.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || isRemote(href) || !/\.css$/i.test(href)) return tag;
    return names.has(basename(href)) ? tag : "";
  });

  content = content.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (tag, src) => {
      if (isRemote(src)) return tag;
      return names.has(basename(src)) ? tag : "";
    },
  );

  return files.map((file) => (file === html ? { ...file, content } : file));
}

/**
 * Turns raw model output into a UI-ready artifact.
 * `web` artifacts need a real HTML entry point; everything else is code-only.
 */
export function normalizeArtifact(parsed, prompt = "") {
  if (!parsed || typeof parsed !== "object") return null;

  let files = normalizeFiles(parsed.files);
  if (files.length === 0) return null;
  files = dropDanglingReferences(files);

  const entry = files.find((file) => /\.html?$/i.test(file.name));
  const requestedType = String(parsed.type || "").toLowerCase();
  const type = requestedType === "code" || !entry ? "code" : "web";

  const language =
    String(parsed.language || "").toLowerCase() || detectLanguage((entry || files[0]).name);

  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 100)
      : prompt.trim().slice(0, 70) || "Generated project";

  return { title, type, language, files };
}
