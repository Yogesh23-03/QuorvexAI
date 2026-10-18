import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../../shared/errors.js";

const requireUser = (req) => {
  const userId = req.headers["x-user-id"];
  if (!userId) throw unauthorized();
  return userId;
};

const requireObjectId = (value, label) => {
  if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
    throw badRequest(`${label} is invalid`);
  }
  return String(value);
};

const loadOwnedConversation = async (userId, conversationId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw notFound("Conversation not found");
  if (String(conversation.userId) !== String(userId)) {
    throw forbidden("You do not have access to this conversation");
  }
  return conversation;
};

export async function createConversation(req, res) {
  const userId = requireUser(req);
  const conversation = await Conversation.create({ userId, title: "New Chat" });
  return res.status(201).json(conversation);
}

export async function getConversations(req, res) {
  const userId = requireUser(req);
  const conversations = await Conversation.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  return res.status(200).json(conversations);
}

export async function updateConversation(req, res) {
  const userId = requireUser(req);
  const { id, title } = req.body || {};
  const conversationId = requireObjectId(id, "conversationId");

  if (typeof title !== "string" || !title.trim()) throw badRequest("title is required");
  const cleanTitle = title.trim().slice(0, 120);

  const conversation = await loadOwnedConversation(userId, conversationId);
  conversation.title = cleanTitle;
  await conversation.save();

  return res.status(200).json(conversation);
}

export async function deleteConversation(req, res) {
  const userId = requireUser(req);
  const conversationId = requireObjectId(req.params.conversationId, "conversationId");

  const conversation = await loadOwnedConversation(userId, conversationId);
  await Promise.all([
    Message.deleteMany({ conversationId: conversation._id }),
    conversation.deleteOne(),
  ]);

  return res.status(200).json({ success: true, deletedId: String(conversation._id) });
}

export async function saveMessage(req, res) {
  const userId = requireUser(req);
  const { conversationId, role, content, images, artifacts } = req.body || {};

  const conversation = await loadOwnedConversation(
    userId,
    requireObjectId(conversationId, "conversationId"),
  );

  if (role !== "user" && role !== "assistant") throw badRequest("role must be user or assistant");
  if (role === "assistant" && !content && !artifacts?.length && !images?.length) {
    throw badRequest("assistant messages need content, images or artifacts");
  }

  const message = await Message.create({
    conversationId: conversation._id,
    role,
    content: typeof content === "string" ? content : "",
    images: Array.isArray(images) ? images.slice(0, 12) : undefined,
    artifacts: Array.isArray(artifacts) ? artifacts : undefined,
  });

  if (role === "user" && (!conversation.title || conversation.title === "New Chat")) {
    conversation.title =
      String(content || "New Chat")
        .trim()
        .slice(0, 60) || "New Chat";
  }
  conversation.updatedAt = new Date();
  await conversation.save();

  return res.status(201).json(message);
}

export async function getMessages(req, res) {
  const userId = requireUser(req);
  const conversationId = requireObjectId(req.params.conversationId, "conversationId");

  await loadOwnedConversation(userId, conversationId);

  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(500).lean();
  return res.status(200).json(messages);
}
