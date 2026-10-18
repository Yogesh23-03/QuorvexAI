import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: String,
    amount: Number,
    currency: {
      type: String,
      default: "INR",
    },
    credits: {
      type: Number,
      required: true,
    },
    plan: {
      type: String,
      required: true,
      enum: ["starter", "pro"],
    },
    status: {
      type: String,
      enum: ["created", "processing", "paid", "failed"],
      default: "created",
      index: true,
    },
    failureReason: String,
  },
  { timestamps: true },
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
export default Payment;
