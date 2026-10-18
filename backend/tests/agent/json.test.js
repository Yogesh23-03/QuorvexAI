import { describe, expect, it } from "vitest";
import { parseJsonLoose, normalizeFiles } from "../../services/agent/utils/json.js";

describe("parseJsonLoose", () => {
  it("parses clean JSON", () => {
    expect(parseJsonLoose('{"files":[]}')).toEqual({ files: [] });
  });

  it("strips markdown fences", () => {
    expect(parseJsonLoose('```json\n{"title":"Deck"}\n```')).toEqual({ title: "Deck" });
  });

  it("recovers JSON embedded in prose", () => {
    expect(parseJsonLoose('Sure! Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it("repairs trailing commas", () => {
    expect(parseJsonLoose('{"files":[{"name":"a"}],}')).toEqual({ files: [{ name: "a" }] });
  });

  it("returns null instead of throwing on garbage", () => {
    expect(parseJsonLoose("definitely not json")).toBeNull();
    expect(parseJsonLoose("")).toBeNull();
    expect(parseJsonLoose(undefined)).toBeNull();
  });
});

describe("normalizeFiles", () => {
  it("keeps only well formed files", () => {
    const files = normalizeFiles([
      { name: "index.html", content: "<h1/>" },
      { name: "broken" },
      "nonsense",
      { name: 12, content: "x" },
    ]);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("index.html");
  });

  it("strips path traversal attempts", () => {
    const files = normalizeFiles([{ name: "../../etc/passwd", content: "x" }]);
    expect(files[0].name).toBe("etc/passwd");
  });

  it("caps the number of files", () => {
    const files = normalizeFiles(
      Array.from({ length: 50 }, (_, i) => ({ name: `f${i}.js`, content: "x" })),
    );
    expect(files).toHaveLength(30);
  });
});
