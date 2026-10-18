import { describe, expect, it } from "vitest";
import { ApiRequestError, normalizeError } from "../lib/api";

describe("normalizeError", () => {
  it("passes through an ApiRequestError", () => {
    const original = new ApiRequestError({ message: "nope", status: 400 });
    expect(normalizeError(original)).toBe(original);
  });

  it("maps a network failure to a friendly message", () => {
    const error = normalizeError({ code: "ERR_NETWORK", message: "Network Error" });
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toMatch(/could not reach/i);
  });

  it("maps a timeout", () => {
    const error = normalizeError({ code: "ECONNABORTED" });
    expect(error.code).toBe("TIMEOUT");
    expect(error.status).toBe(504);
  });

  it("uses the structured backend error envelope", () => {
    const error = normalizeError({
      response: {
        status: 402,
        data: {
          success: false,
          error: { code: "INSUFFICIENT_CREDITS", message: "You are out of credits." },
          requestId: "req-1",
        },
      },
    });

    expect(error.code).toBe("INSUFFICIENT_CREDITS");
    expect(error.isCreditsError).toBe(true);
    expect(error.requestId).toBe("req-1");
  });

  it("falls back to a friendly message per status", () => {
    const error = normalizeError({ response: { status: 429, data: {} } });
    expect(error.isRateLimit).toBe(true);
    expect(error.message).toMatch(/too quickly/i);
  });

  it("flags auth errors", () => {
    expect(normalizeError({ response: { status: 401, data: {} } }).isAuthError).toBe(true);
  });
});
