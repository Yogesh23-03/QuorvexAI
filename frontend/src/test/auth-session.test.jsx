import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ configured: false }));
const post = vi.hoisted(() => vi.fn());
const setAccessToken = vi.hoisted(() => vi.fn());
const signInWithPopup = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock("../lib/api", () => ({
  default: { post, get: vi.fn() },
  ApiRequestError: class ApiRequestError extends Error {},
  setAccessToken,
}));

vi.mock("../lib/firebase", () => ({
  isFirebaseConfigured: () => state.configured,
  getFirebaseAuth: vi.fn(async () => ({ kind: "auth" })),
  getGoogleProvider: vi.fn(async () => ({ kind: "provider" })),
}));

vi.mock("firebase/auth", () => ({ signInWithPopup, signOut }));

const { loginWithGoogle, loginWithPassword, logout, registerWithPassword } =
  await import("../features/auth");

beforeEach(() => {
  state.configured = false;
  post.mockResolvedValue({ data: { _id: "user-1", accessToken: "access-token" } });
  signOut.mockResolvedValue(undefined);
});

describe("session handling", () => {
  it("hands the access token to the api client after a password login", async () => {
    const user = await loginWithPassword({ email: "ada@example.com", password: "Passw0rd123" });

    expect(post).toHaveBeenCalledWith("/api/auth/login", {
      email: "ada@example.com",
      password: "Passw0rd123",
    });
    expect(setAccessToken).toHaveBeenCalledWith("access-token");
    expect(user.accessToken).toBe("access-token");
  });

  it("hands the access token to the api client after a signup", async () => {
    await registerWithPassword({ name: "Ada", email: "ada@example.com", password: "Passw0rd123" });

    expect(setAccessToken).toHaveBeenCalledWith("access-token");
  });

  it("resolves the Firebase helpers before starting the Google popup", async () => {
    state.configured = true;
    signInWithPopup.mockResolvedValue({ user: { getIdToken: async () => "firebase-id-token" } });

    await loginWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledWith({ kind: "auth" }, { kind: "provider" });
    expect(post).toHaveBeenCalledWith("/api/auth/login", { token: "firebase-id-token" });
    expect(setAccessToken).toHaveBeenCalledWith("access-token");
  });

  it("drops the in-memory token on logout and survives an empty Google session", async () => {
    state.configured = true;
    signOut.mockRejectedValue(new Error("auth/no-current-user"));

    await expect(logout()).resolves.toBeUndefined();

    expect(setAccessToken).toHaveBeenCalledWith(null);
  });
});
