import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { graphInvoke } = vi.hoisted(() => ({ graphInvoke: vi.fn() }));
const { deductCredits, refundCredits } = vi.hoisted(() => ({
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
}));
const { saveMessage } = vi.hoisted(() => ({ saveMessage: vi.fn() }));
const { fetchUser } = vi.hoisted(() => ({ fetchUser: vi.fn() }));
const { checkAgentLimit } = vi.hoisted(() => ({ checkAgentLimit: vi.fn() }));
const { resolveAgent } = vi.hoisted(() => ({ resolveAgent: vi.fn() }));

vi.mock("../../services/agent/graph/graph.js", () => ({
  graph: { invoke: graphInvoke },
  default: { invoke: graphInvoke },
}));

vi.mock("../../services/agent/graph/router.js", () => ({
  resolveAgent,
  ROUTABLE_AGENTS: ["chat", "search", "coding", "pdf", "ppt", "vision"],
}));

vi.mock("../../services/agent/utils/credits.js", () => ({ deductCredits, refundCredits }));
vi.mock("../../services/agent/utils/chatClient.js", () => ({
  saveMessage,
  getMessages: vi.fn(async () => []),
}));
vi.mock("../../services/agent/utils/userClient.js", () => ({ fetchUser }));
vi.mock("../../services/agent/config/agentLimit.js", () => ({ checkAgentLimit }));
vi.mock("../../services/agent/config/memory.js", () => ({
  addMessage: vi.fn(),
  getMemory: vi.fn(async () => []),
}));

const USER = "68a1f0000000000000000001";
const CONVERSATION = "68a1f0000000000000000123";
let app;
let uploadDir;

const filesInUploadDir = () => (fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);

beforeAll(async () => {
  uploadDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "quorvex-uploads");
  const { createApp } = await import("../../services/agent/app.js");
  app = createApp();
});

beforeEach(() => {
  graphInvoke.mockReset();
  deductCredits.mockReset();
  refundCredits.mockReset().mockResolvedValue({ success: true });
  saveMessage.mockReset().mockResolvedValue({ _id: "msg" });
  fetchUser.mockReset().mockResolvedValue({ credits: 90, totalCredits: 100 });
  checkAgentLimit.mockReset().mockResolvedValue({ remaining: 5, limit: 5 });
  resolveAgent.mockReset().mockResolvedValue("chat");
});

afterAll(() => {
  filesInUploadDir().forEach((file) => fs.rmSync(path.join(uploadDir, file), { force: true }));
});

const post = () =>
  request(app)
    .post("/chat")
    .set("x-user-id", USER)
    .field("prompt", "hello there")
    .field("conversationId", CONVERSATION)
    .field("agent", "auto");

describe("POST /chat", () => {
  it("requires a user id", async () => {
    const res = await request(app).post("/chat").field("prompt", "hi");
    expect(res.status).toBe(401);
  });

  it("requires a prompt", async () => {
    const res = await request(app)
      .post("/chat")
      .set("x-user-id", USER)
      .field("conversationId", CONVERSATION);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("charges exactly once and returns the routed agent", async () => {
    resolveAgent.mockResolvedValue("search");
    graphInvoke.mockResolvedValue({
      aiResponse: "Answer from search",
      images: ["https://img/1.png"],
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("Answer from search");
    expect(res.body.agent).toBe("search");
    expect(res.body.credits).toBe(90);
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(deductCredits).toHaveBeenCalledWith(USER, "search");
    expect(refundCredits).not.toHaveBeenCalled();
    expect(saveMessage).toHaveBeenCalledTimes(2);
  });

  it("returns coding artifacts", async () => {
    resolveAgent.mockResolvedValue("coding");
    graphInvoke.mockResolvedValue({
      aiResponse: "done",
      artifacts: [
        {
          id: 1,
          type: "Project",
          title: "site",
          files: [{ name: "index.html", content: "<h1/>" }],
        },
      ],
    });

    const res = await post();
    expect(res.body.artifacts).toHaveLength(1);
    expect(res.body.artifacts[0].files[0].name).toBe("index.html");
  });

  it("refuses to run when credits run out and never calls the graph", async () => {
    const error = new Error("You are out of credits.");
    error.status = 402;
    error.code = "INSUFFICIENT_CREDITS";
    deductCredits.mockRejectedValue(error);

    const res = await post();

    expect(res.status).toBe(402);
    expect(res.body.error.message).toMatch(/out of credits/i);
    expect(graphInvoke).not.toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("refunds the reservation when the graph fails", async () => {
    const error = new Error("model exploded");
    error.status = 502;
    error.code = "CHAT_FAILED";
    graphInvoke.mockRejectedValue(error);

    const res = await post();

    expect(res.status).toBe(502);
    expect(refundCredits).toHaveBeenCalledWith(USER, "chat");
    expect(saveMessage).not.toHaveBeenCalled();
  });

  it("refunds and reports 429 when the per-agent rate limit is hit", async () => {
    const error = new Error("slow down");
    error.status = 429;
    error.code = "RATE_LIMITED";
    checkAgentLimit.mockRejectedValue(error);

    const res = await post();

    expect(res.status).toBe(429);
    expect(refundCredits).toHaveBeenCalledWith(USER, "chat");
    expect(graphInvoke).not.toHaveBeenCalled();
  });

  it("removes the temporary upload after a run", async () => {
    graphInvoke.mockResolvedValue({ aiResponse: "ok" });
    const before = filesInUploadDir().length;

    const res = await request(app)
      .post("/chat")
      .set("x-user-id", USER)
      .field("prompt", "analyse this")
      .field("conversationId", CONVERSATION)
      .attach("file", Buffer.from("%PDF-1.4 fake"), {
        filename: "doc.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(200);
    expect(filesInUploadDir().length).toBe(before);
  });

  it("rejects unsupported upload types with a friendly error", async () => {
    const res = await request(app)
      .post("/chat")
      .set("x-user-id", USER)
      .field("prompt", "upload")
      .field("conversationId", CONVERSATION)
      .attach("file", Buffer.from("MZ"), {
        filename: "virus.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/PDF and image/i);
  });
});
