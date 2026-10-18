/** Tiny classname joiner (keeps us off an extra dependency). */
export function cx(...values) {
  return values.flat().filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function formatCredits(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("en-IN");
}

export function timeAgo(date) {
  const value = new Date(date).getTime();
  if (!Number.isFinite(value)) return "";
  const seconds = Math.max(1, Math.round((Date.now() - value) / 1000));
  const units = [
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [label, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return `${seconds}s ago`;
}

export function truncate(text, max = 48) {
  const value = String(text || "").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export const isPdf = (file) => file?.type === "application/pdf";
export const isImage = (file) => Boolean(file?.type?.startsWith("image/"));

export function formatCountdown(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Resetting…";
  const minutes = Math.ceil(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

export function humanFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
