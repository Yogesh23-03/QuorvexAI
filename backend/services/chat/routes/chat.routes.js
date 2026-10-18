import express from "express";
import {
  createConversation,
  deleteConversation,
  getConversations,
  getMessages,
  saveMessage,
  updateConversation,
} from "../controllers/chat.controller.js";
import { requireInternalKey } from "../../../shared/internalAuth.js";
import { asyncHandler } from "../../../shared/errors.js";

const router = express.Router();

// Conversations are only ever touched through the gateway, which injects x-user-id.
router.use(requireInternalKey);

router.post("/create-conversation", asyncHandler(createConversation));
router.get("/get-conversations", asyncHandler(getConversations));
router.post("/update-conversation", asyncHandler(updateConversation));
router.delete("/conversations/:conversationId", asyncHandler(deleteConversation));
router.post("/save-message", asyncHandler(saveMessage));
router.get("/get-messages/:conversationId", asyncHandler(getMessages));

export default router;
