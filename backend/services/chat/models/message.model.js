import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    content: { type: String, default: "" },
  },
  { _id: false },
);

const artifactSchema = new mongoose.Schema(
  {
    id: Number,
    type: String,
    title: String,
    files: [fileSchema],
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, default: "" },
    images: {
      type: [String],
      default: undefined,
    },
    artifacts: {
      type: [artifactSchema],
      default: undefined,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;
