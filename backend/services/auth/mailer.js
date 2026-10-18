import nodemailer from "nodemailer";
import { logger } from "../../shared/logger.js";

let transporter = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

/**
 * Sends mail through SMTP when configured. In development (or tests) the
 * message is logged instead, so reset flows work without an inbox.
 */
async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || "QuorvexAI <no-reply@quorvex.ai>";

  if (!smtpConfigured()) {
    logger.info(
      { to, subject, preview: text?.slice(0, 160) },
      "mail suppressed (SMTP not configured)",
    );
    return { delivered: false, reason: "smtp-not-configured" };
  }

  await getTransporter().sendMail({ from, to, subject, text, html });
  return { delivered: true };
}

export async function sendPasswordReset(email, link) {
  return sendMail({
    to: email,
    subject: "Reset your QuorvexAI password",
    text: `Use this single-use link within 30 minutes to reset your password:\n\n${link}\n\nIf you did not request it, ignore this email.`,
    html: `<p>Use this single-use link within 30 minutes to reset your password:</p><p><a href="${link}">${link}</a></p><p>If you did not request it, ignore this email.</p>`,
  });
}
