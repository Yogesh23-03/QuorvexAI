/**
 * Builds a single self-contained HTML document from generated project files.
 *
 * Generated projects reference `style.css` / `script.js` by name, but the
 * sandbox iframe only ever receives `srcdoc`. This inlines every local
 * stylesheet and script, moves scripts to the end of the body (so DOM lookups
 * work without DOMContentLoaded gymnastics) and leaves absolute CDN URLs
 * untouched.
 */

const basename = (value = "") => String(value).split(/[?#]/)[0].split(/[\\/]/).pop().toLowerCase();

function findFile(files, reference) {
  const target = basename(reference);
  return (
    files.find((file) => basename(file.name) === target) ||
    files.find((file) => String(file.name).toLowerCase().endsWith(target)) ||
    null
  );
}

const isRemote = (url = "") => /^(https?:)?\/\//i.test(url) || url.startsWith("data:");

const ERROR_HOOK = `
<script>
(function () {
  function report(message) {
    try {
      parent.postMessage({ __quorvexSandbox: true, type: "error", message: String(message) }, "*");
    } catch (error) {}
  }
  window.addEventListener("error", function (event) {
    report(event.message || "Runtime error");
  });
  window.addEventListener("unhandledrejection", function (event) {
    report((event.reason && event.reason.message) || event.reason || "Unhandled rejection");
  });
  document.addEventListener("click", function (event) {
    var anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor) return;
    var href = anchor.getAttribute("href") || "";
    if (href.startsWith("#") || href.startsWith("javascript:")) return;
    event.preventDefault();
    report("Blocked navigation to " + href);
  });
})();
</script>`;

export function buildPreviewDocument(files = []) {
  const htmlFile =
    files.find((file) => /\.html?$/i.test(file.name)) ||
    files.find((file) => /\.jsx?$/i.test(file.name)) ||
    files[0];

  if (!htmlFile) return null;

  let doc = String(htmlFile.content || "");
  const scripts = [];

  // Inline local stylesheets.
  doc = doc.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || isRemote(href) || !/\.css$/i.test(href)) return tag;
    const file = findFile(files, href);
    return file ? `<style data-from="${file.name}">\n${file.content}\n</style>` : tag;
  });

  // Pull local scripts out; they are re-inserted before </body>.
  doc = doc.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attrs, inline) => {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (src) {
      if (isRemote(src)) {
        scripts.push(`<script src="${src}"></script>`);
      } else {
        const file = findFile(files, src);
        if (file) scripts.push(`<script data-from="${file.name}">\n${file.content}\n</script>`);
      }
      return "";
    }
    if (inline.trim()) {
      scripts.push(`<script>${inline}</script>`);
      return "";
    }
    return tag;
  });

  // No <link>/<script> references at all? Inject matching local files anyway so
  // a model that forgot the wiring still produces a working preview.
  const referenced = (extension) =>
    files.some((file) => extension.test(file.name) && doc.includes(basename(file.name)));

  const cssFiles = files.filter((file) => /\.css$/i.test(file.name));
  if (cssFiles.length && !/<style[\s>]/i.test(doc) && !referenced(/\.css$/i)) {
    const css = cssFiles.map((file) => `<style>\n${file.content}\n</style>`).join("\n");
    doc = doc.includes("</head>") ? doc.replace("</head>", `${css}\n</head>`) : `${css}\n${doc}`;
  }

  const jsFiles = files.filter(
    (file) =>
      /\.(js|mjs)$/i.test(file.name) &&
      !/\.(config|min)\.js$/i.test(file.name) &&
      !scripts.some((script) => script.includes(`data-from="${file.name}"`)),
  );

  if (jsFiles.length) {
    const referencedNames = jsFiles.filter((file) => doc.includes(basename(file.name)));
    const candidates = referencedNames.length ? referencedNames : jsFiles;
    candidates.forEach((file) => {
      scripts.push(`<script data-from="${file.name}">\n${file.content}\n</script>`);
    });
  }

  const payload = `${ERROR_HOOK}\n${scripts.join("\n")}`;
  if (doc.includes("</body>")) doc = doc.replace("</body>", `${payload}\n</body>`);
  else if (doc.includes("</html>")) doc = doc.replace("</html>", `${payload}\n</html>`);
  else doc = `${doc}\n${payload}`;

  return doc;
}

export function hasPreview(files = []) {
  return files.some((file) => /\.html?$/i.test(file.name));
}
