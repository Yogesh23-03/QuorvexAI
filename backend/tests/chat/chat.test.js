import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb } from "../helpers/db.js";

const USER = "68a1f0000000000000000001";
const OTHER = "68a1f0000000000000000002";

let app;
let Conversation;
let Message;

beforeAll(async () => {
  await connectTestDb("quorvex_test_chat");
  ({ default: Conversation } = await import("../../services/chat/models/conversation.model.js"));
  ({ default: Message } = await import("../../services/chat/models/message.model.js"));
  const { createApp } = await import("../../services/chat/app.js");
  app = createApp();
});

beforeEach(async () => {
  await Conversation.deleteMany({});
  await Message.deleteMany({});
});

afterAll(async () => {
  await disconnectTestDb();
});

const asUser = (req) => req.set("x-user-id", USER);

describe("conversations", () => {
  it("requires an authenticated user", async () => {
    const res = await request(app).post("/create-conversation");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates a conversation and lists it newest first", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("New Chat");

    await new Promise((resolve) => setTimeout(resolve, 5));
    await asUser(request(app).post("/create-conversation"));

    const list = await asUser(request(app).get("/get-conversations"));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(new Date(list.body[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list.body[1].updatedAt).getTime(),
    );
  });

  it("renames a conversation", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    const res = await asUser(
      request(app)
        .post("/update-conversation")
        .send({ id: created.body._id, title: "Explain Redis streams" }),
    );

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Explain Redis streams");
  });

  it("rejects an invalid conversation id", async () => {
    const res = await asUser(
      request(app).post("/update-conversation").send({ id: "not-an-id", title: "x" }),
    );
    expect(res.status).toBe(400);
  });

  it("blocks access to another user's conversation", async () => {
    const created = await asUser(request(app).post("/create-conversation"));

    const update = await request(app)
      .post("/update-conversation")
      .set("x-user-id", OTHER)
      .send({ id: created.body._id, title: "hijack" });
    expect(update.status).toBe(403);

    const messages = await request(app)
      .get(`/get-messages/${created.body._id}`)
      .set("x-user-id", OTHER);
    expect(messages.status).toBe(403);
  });

  it("deletes a conversation with its messages", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    await asUser(
      request(app)
        .post("/save-message")
        .send({ conversationId: created.body._id, role: "user", content: "hello" }),
    );

    const res = await asUser(request(app).delete(`/conversations/${created.body._id}`));
    expect(res.status).toBe(200);
    expect(await Message.countDocuments()).toBe(0);
    expect(await Conversation.countDocuments()).toBe(0);
  });
});

describe("messages", () => {
  it("saves and returns messages in chronological order", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    const conversationId = created.body._id;

    await asUser(
      request(app).post("/save-message").send({ conversationId, role: "user", content: "first" }),
    );
    await asUser(
      request(app)
        .post("/save-message")
        .send({ conversationId, role: "assistant", content: "second", artifacts: [] }),
    );

    const res = await asUser(request(app).get(`/get-messages/${conversationId}`));
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.content)).toEqual(["first", "second"]);
    expect(res.body.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("stores artifacts produced by the coding agent", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    const artifacts = [
      {
        id: 1,
        type: "Project",
        title: "Landing page",
        files: [{ name: "index.html", content: "<h1>Hi</h1>" }],
      },
    ];

    await asUser(
      request(app)
        .post("/save-message")
        .send({ conversationId: created.body._id, role: "assistant", content: "done", artifacts }),
    );

    const res = await asUser(request(app).get(`/get-messages/${created.body._id}`));
    expect(res.body[0].artifacts[0].files[0].name).toBe("index.html");
  });

  it("rejects an empty assistant message", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    const res = await asUser(
      request(app)
        .post("/save-message")
        .send({ conversationId: created.body._id, role: "assistant", content: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("auto-titles a conversation from the first user message", async () => {
    const created = await asUser(request(app).post("/create-conversation"));
    await asUser(
      request(app).post("/save-message").send({
        conversationId: created.body._id,
        role: "user",
        content: "Build me a landing page",
      }),
    );

    const list = await asUser(request(app).get("/get-conversations"));
    expect(list.body[0].title).toBe("Build me a landing page");
  });
});
