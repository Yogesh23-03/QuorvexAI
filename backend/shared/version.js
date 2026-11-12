import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The npm_package_version variable only exists under `npm start`. Containers
 * run `node index.js` directly, so read the manifest that ships in the image.
 */
function readVersion() {
  const candidates = [
    path.resolve(here, "../package.json"),
    path.resolve(here, "../../package.json"),
  ];
  for (const file of candidates) {
    try {
      const { version } = JSON.parse(fs.readFileSync(file, "utf8"));
      if (version) return String(version);
    } catch {
      /* try the next candidate */
    }
  }
  return "1.0.0";
}

const version = process.env.SERVICE_VERSION || process.env.npm_package_version || readVersion();

export const appVersion = () => version;

export default appVersion;
