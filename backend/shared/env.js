import { logger } from "./logger.js";

/**
 * Small startup env checker. It never prints values — only the names of the
 * variables that are missing or malformed — so a misconfigured deployment fails
 * with an actionable message instead of a stack trace deep inside a request.
 */

const URL_PATTERN = /^https?:\/\/[^\s]+$/;

// A .env written on Windows keeps its CRLF line endings, so every value can
// arrive with a trailing \r. Validate the trimmed value or a perfectly good
// PORT=8000 is reported as invalid on every boot.
const clean = (value) => String(value ?? "").trim();

export const validators = {
  url: { test: (value) => URL_PATTERN.test(clean(value)), hint: "must be an absolute http(s) URL" },
  port: {
    test: (value) => {
      const text = clean(value);
      return /^\d+$/.test(text) && Number(text) > 0 && Number(text) < 65536;
    },
    hint: "must be a TCP port between 1 and 65535",
  },
  positiveInt: {
    test: (value) => {
      const text = clean(value);
      return /^\d+$/.test(text) && Number(text) > 0;
    },
    hint: "must be a positive integer",
  },
  mongoUri: {
    test: (value) => /^mongodb(\+srv)?:\/\//.test(clean(value)),
    hint: "must start with mongodb:// or mongodb+srv://",
  },
  redisUri: {
    test: (value) => /^rediss?:\/\//.test(clean(value)),
    hint: "must start with redis:// or rediss://",
  },
  booleanish: {
    test: (value) => ["true", "false", "1", "0"].includes(clean(value).toLowerCase()),
    hint: "must be true or false",
  },
};

const isProduction = () => process.env.NODE_ENV === "production";

function normalise(rule) {
  return typeof rule === "string" ? { name: rule } : rule;
}

function inspect(rules) {
  const missing = [];
  const invalid = [];

  for (const raw of rules) {
    const rule = normalise(raw);
    const value = process.env[rule.name];

    if (value === undefined || String(value).trim() === "") {
      missing.push(rule.name);
      continue;
    }

    if (rule.validator && !rule.validator.test(value)) {
      invalid.push(`${rule.name} (${rule.validator.hint})`);
    }
  }

  return { missing, invalid };
}

/**
 * @param {object} options
 * @param {string} options.service  Reported name, e.g. "auth-service".
 * @param {Array}  [options.required]   Always required; a failure stops boot.
 * @param {Array}  [options.production] Required only when NODE_ENV=production.
 * @param {Array}  [options.recommended] Never fatal; logged as a warning.
 * @returns {{ ok: boolean, missing: string[], invalid: string[] }}
 */
export function validateEnv({ service, required = [], production = [], recommended = [] }) {
  const hardRules = isProduction() ? [...required, ...production] : required;
  const hard = inspect(hardRules);
  const soft = inspect(recommended);

  const ok = hard.missing.length === 0 && hard.invalid.length === 0;

  if (hard.missing.length || hard.invalid.length) {
    const details = [
      hard.missing.length ? `missing: ${hard.missing.join(", ")}` : null,
      hard.invalid.length ? `invalid: ${hard.invalid.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    logger.error(
      { service, missing: hard.missing, invalid: hard.invalid },
      `${service} is misconfigured — ${details}`,
    );

    if (isProduction() || hard.missing.length > 0) {
      throw new Error(`${service} cannot start: ${details}. See .env.example.`);
    }
  }

  if (soft.missing.length || soft.invalid.length) {
    logger.warn(
      { service, missing: soft.missing, invalid: soft.invalid },
      `${service} is missing optional configuration; related features stay disabled`,
    );
  }

  return { ok, missing: hard.missing, invalid: hard.invalid };
}

export default validateEnv;
