/**
 * Lazy credit top-up policy.
 *
 * Every CREDIT_RESET_HOURS the balance is restored to CREDIT_RESET_AMOUNT, but
 * only for users who are BELOW the amount: purchased credits above it are never
 * reduced. There is no cron — every read/deduction calls `applyCreditReset`,
 * which performs one atomic conditional update so concurrent service instances
 * cannot reset (or double-reset) the same user.
 */

export function resetHours() {
  const value = Number(process.env.CREDIT_RESET_HOURS);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

export function resetAmount() {
  const value = Number(process.env.CREDIT_RESET_AMOUNT);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

export function nextResetAt(user) {
  const anchor = user?.lastCreditResetAt || user?.createdAt || new Date();
  const date = new Date(anchor);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + resetHours() * 60 * 60 * 1000).toISOString();
}

/**
 * Atomically tops the account up when the window has elapsed and the balance is
 * below the reset amount. Returns the updated document, or null when no reset
 * was needed/applied.
 */
export async function applyCreditReset(User, userId) {
  if (!userId) return null;
  const amount = resetAmount();
  const cutoff = new Date(Date.now() - resetHours() * 60 * 60 * 1000);

  return User.findOneAndUpdate(
    {
      _id: userId,
      credits: { $lt: amount },
      $or: [{ lastCreditResetAt: { $lte: cutoff } }, { lastCreditResetAt: { $exists: false } }],
    },
    { $set: { credits: amount, lastCreditResetAt: new Date() } },
    { returnDocument: "after" },
  );
}

export function creditsView(user) {
  return {
    credits: user.credits,
    totalCredits: user.totalCredits,
    nextResetAt: nextResetAt(user),
    resetHours: resetHours(),
    resetAmount: resetAmount(),
  };
}
