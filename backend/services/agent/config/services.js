const DEFAULTS = {
  CHAT_SERVICE: "http://127.0.0.1:8002",
  AUTH_SERVICE: "http://127.0.0.1:8001",
};

export function serviceUrl(name) {
  const value = process.env[name] || (process.env.NODE_ENV === "production" ? "" : DEFAULTS[name]);
  if (!value) throw new Error(`${name} is not configured`);
  return value.replace(/\/+$/, "");
}
