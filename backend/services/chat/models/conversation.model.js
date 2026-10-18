import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Chat",
      trim: true,
      maxlength: 120,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
export default Conversation;
