import axios from "axios";

// The base URL always comes from the environment; the localhost default is a
// development convenience so `npm run dev` works before .env exists. A
// production build without VITE_SERVER_URL fails in vite.config.js.
const configuredBaseUrl = String(import.meta.env.VITE_SERVER_URL || "").trim();

export const API_BASE_URL = (configuredBaseUrl || "https://d29sakx18qchic.cloudfront.net").replace(/\/+$/, "");

/** Normalised error so every screen can render the same friendly message. */
export class ApiRequestError extends Error {
  constructor({ message, code = "REQUEST_FAILED", status = 0, details, requestId }) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }

  get isAuthError() {
    return this.status === 401;
  }

  get isCreditsError() {
    return this.code === "INSUFFICIENT_CREDITS";
  }

  get isRateLimit() {
    return this.status === 429;
  }
}

const FALLBACK_MESSAGES = {
  400: "That request did not look right. Please check and try again.",
  401: "Your session expired. Please sign in again.",
  402: "You are out of credits. Upgrade to keep creating.",
  403: "You do not have access to that resource.",
  404: "We could not find what you asked for.",
  413: "That file is too large. The limit is 20MB.",
  429: "You are sending requests too quickly. Please slow down.",
  502: "The agents could not answer that. Please try again.",
  503: "The service is waking up. Please try again in a moment.",
  504: "That request took too long. Please try again.",
};

export function normalizeError(error) {
  if (error instanceof ApiRequestError) return error;

  if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
    return new ApiRequestError({
      message: "We could not reach QuorvexAI. Check your connection and try again.",
      code: "NETWORK_ERROR",
    });
  }

  if (error?.code === "ECONNABORTED") {
    return new ApiRequestError({ message: FALLBACK_MESSAGES[504], code: "TIMEOUT", status: 504 });
  }

  const response = error?.response;
  if (response) {
    const body = response.data || {};
    const message =
      body?.error?.message ||
      body?.message ||
      FALLBACK_MESSAGES[response.status] ||
      "Something went wrong.";
    return new ApiRequestError({
      message,
      code: body?.error?.code || "REQUEST_FAILED",
      status: response.status,
      details: body?.error?.details,
      requestId: body?.requestId,
    });
  }

  return new ApiRequestError({ message: "Something went wrong. Please try again." });
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 190000,
});

/**
 * Access token lives in memory only: it is never written to localStorage, so
 * an XSS bug cannot lift a long-lived credential. The refresh token is an
 * httpOnly cookie that this module cannot read at all.
 */
let accessToken = null;
let refreshRequest = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/** One refresh at a time, shared by every request that hit a 401 together. */
function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${API_BASE_URL}/api/auth/refresh`, null, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data?.accessToken);
        return data;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const status = error?.response?.status;
    const url = config?.url || "";
    const isAuthCall = /\/auth\/(login|register|refresh|logout)/.test(url);

    if (status === 401 && config && !config.__retried && !isAuthCall) {
      config.__retried = true;
      try {
        await refreshAccessToken();
        return api(config);
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export default api;
