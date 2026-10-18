import { describe, expect, it, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("../../services/agent/config/llmModel.js", () => ({
  getModel: () => ({ invoke }),
  extractText: (response) => (typeof response?.content === "string" ? response.content : ""),
}));

const { resolveAgent } = await import("../../services/agent/graph/router.js");

beforeEach(() => {
  invoke.mockReset();
});

describe("resolveAgent", () => {
  it("honours an explicitly requested agent", async () => {
    await expect(resolveAgent({ prompt: "hi", agent: "coding" })).resolves.toBe("coding");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("routes a PDF upload to the document reader regardless of the model", async () => {
    const result = await resolveAgent({
      prompt: "summarise",
      agent: "auto",
      file: { mimetype: "application/pdf" },
    });
    expect(result).toBe("pdfRag");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("routes an image upload to the vision analyst", async () => {
    await expect(
      resolveAgent({ prompt: "what is this", agent: "auto", file: { mimetype: "image/png" } }),
    ).resolves.toBe("imageAnalyzer");
  });

  it("uses the classifier output when it is valid", async () => {
    invoke.mockResolvedValue({ content: "search" });
    await expect(resolveAgent({ prompt: "latest AI news", agent: "auto" })).resolves.toBe("search");
  });

  it("cleans up noisy classifier output", async () => {
    invoke.mockResolvedValue({ content: "  Search.\n" });
    await expect(resolveAgent({ prompt: "news", agent: "auto" })).resolves.toBe("search");
  });

  it("falls back to chat when the classifier output is nonsense", async () => {
    invoke.mockResolvedValue({ content: "banana" });
    await expect(resolveAgent({ prompt: "hi", agent: "auto" })).resolves.toBe("chat");
  });

  it("falls back to chat when the classifier throws", async () => {
    invoke.mockRejectedValue(new Error("groq down"));
    await expect(resolveAgent({ prompt: "hi", agent: "auto" })).resolves.toBe("chat");
  });

  it("falls back to chat for an unknown explicit agent", async () => {
    invoke.mockResolvedValue({ content: "chat" });
    await expect(resolveAgent({ prompt: "hi", agent: "notarealagent" })).resolves.toBe("chat");
  });
});
