import mongoose from "mongoose";
import { nextResetAt } from "../../../shared/creditPolicy.js";

const userSchema = new mongoose.Schema(
  {
    // Set for Google/Firebase identities; optional for email+password accounts.
    firebaseUid: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
    name: String,
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    authProviders: {
      type: [{ type: String, enum: ["password", "google"] }],
      default: [],
    },
    avatar: String,
    plan: {
      type: String,
      enum: ["free", "starter", "pro"],
      default: "free",
    },
    credits: {
      type: Number,
      default: 100,
      min: 0,
    },
    totalCredits: {
      type: Number,
      default: 100,
      min: 0,
    },
    planExpiresAt: Date,
    lastCreditResetAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Case-insensitive uniqueness without breaking legacy documents that have no email yet.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.firebaseUid;
    delete ret.passwordHash;
    ret.nextResetAt = nextResetAt(ret);
    ret.providers = ret.authProviders?.length ? ret.authProviders : ["password"];
    return ret;
  },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
