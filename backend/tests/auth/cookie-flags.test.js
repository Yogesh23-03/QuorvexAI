import { afterEach, describe, expect, it, vi } from "vitest";
import { cookieConfig } from "../../shared/tokens.js";

/**
 * Cookie flags decide whether a session survives a page reload.
 *
 * Production shape (Vite SPA on one host, gateway on another): the browser
 * treats the API call as cross-site, and a SameSite=Lax cookie is stored but
 * never sent back — /api/me then answers 401 and the visitor has to sign in
 * again on every refresh. The flag is therefore chosen per request.
 */
const request = ({ site, origin, host = "quorvexai-gateway.onrender.com" } = {}) => ({
  headers: {
    ...(site ? { "sec-fetch-site": site } : {}),
    ...(origin ? { origin } : {}),
    host,
  },
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session cookie flags", () => {
  it("keeps SameSite=Lax when one origin serves the SPA and the API", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "");

    expect(cookieConfig(request({ site: "same-origin" }))).toMatchObject({
      secure: true,
      sameSite: "lax",
    });
  });

  it("uses SameSite=None for a cross-site SPA so the cookie is sent back", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "");

    expect(cookieConfig(request({ site: "cross-site" }))).toMatchObject({
      secure: true,
      sameSite: "none",
    });
  });

  it("treats an explicitly configured lax as 'lax where lax works'", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "lax");

    expect(cookieConfig(request({ site: "cross-site" })).sameSite).toBe("none");
    expect(cookieConfig(request({ site: "same-site" })).sameSite).toBe("lax");
  });

  it("honours an explicit strict or none", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "strict");
    expect(cookieConfig(request({ site: "cross-site" })).sameSite).toBe("strict");

    vi.stubEnv("COOKIE_SAMESITE", "none");
    expect(cookieConfig(request({ site: "same-origin" })).sameSite).toBe("none");
  });

  it("falls back to Lax over plain http, where browsers drop SameSite=None", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COOKIE_SAMESITE", "");

    expect(cookieConfig(request({ site: "cross-site" }))).toMatchObject({
      secure: false,
      sameSite: "lax",
    });
  });

  it("compares Origin with the request host when Sec-Fetch-Site is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SAMESITE", "");

    expect(
      cookieConfig(request({ origin: "https://quorvex-ai.vercel.app" })).sameSite,
    ).toBe("none");
    expect(
      cookieConfig(request({ origin: "https://quorvexai-gateway.onrender.com" })).sameSite,
    ).toBe("lax");
    // Server-to-server calls (no Origin) are not browser sessions.
    expect(cookieConfig({ headers: { "x-internal-key": "k" } }).sameSite).toBe("lax");
  });

  it("never emits SameSite=None without Secure", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "false");
    vi.stubEnv("COOKIE_SAMESITE", "none");

    expect(cookieConfig(request({ site: "cross-site" }))).toMatchObject({
      secure: false,
      sameSite: "lax",
    });
  });
});
