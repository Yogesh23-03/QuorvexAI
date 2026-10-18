import { signInWithPopup, signOut } from "firebase/auth";
import api, { ApiRequestError } from "../lib/api";
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from "../lib/firebase";

/** Returns the signed-in user, or null when there is no valid session. */
export async function fetchCurrentUser() {
  try {
    const { data } = await api.get("/api/me");
    return data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.isAuthError) return null;
    // A 404 means the session exists but the account is gone: treat as signed out.
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

async function googleIdToken() {
  if (!isFirebaseConfigured()) {
    throw new ApiRequestError({
      message:
        "Google sign-in is not configured. Add VITE_FIREBASE_* values to the frontend environment.",
      code: "FIREBASE_NOT_CONFIGURED",
    });
  }
  const credential = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
  return credential.user.getIdToken();
}

export async function loginWithGoogle() {
  const token = await googleIdToken();
  const { data } = await api.post("/api/auth/login", { token });
  return data;
}

export async function registerWithPassword({ name, email, password }) {
  const { data } = await api.post("/api/auth/register", { name, email, password });
  return data;
}

export async function loginWithPassword({ email, password }) {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data;
}

export async function forgotPassword(email) {
  const { data } = await api.post("/api/auth/forgot-password", { email });
  return data;
}

export async function resetPassword({ token, password }) {
  const { data } = await api.post("/api/auth/reset-password", { token, password });
  return data;
}

export async function logout() {
  try {
    await api.get("/api/auth/logout");
  } catch {
    /* the cookie may already be gone */
  } finally {
    if (isFirebaseConfigured()) {
      await signOut(getFirebaseAuth()).catch(() => undefined);
    }
  }
}

/** Shared client-side password policy so the form matches the server. */
export function passwordIssues(password = "") {
  const issues = [];
  if (password.length < 8) issues.push("At least 8 characters");
  if (!/[a-zA-Z]/.test(password)) issues.push("One letter");
  if (!/\d/.test(password)) issues.push("One number");
  return issues;
}

export function passwordStrength(password = "") {
  const issues = passwordIssues(password);
  if (!password) return { score: 0, label: "empty" };
  const bonus = password.length >= 12 ? 1 : 0;
  const score = Math.max(0, 3 - issues.length + bonus);
  return { score, label: ["weak", "fair", "good", "strong"][Math.min(score, 3)] };
}
