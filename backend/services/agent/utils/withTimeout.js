import { ApiError } from "../../../shared/errors.js";

export async function withTimeout(
  promise,
  ms,
  message = "This is taking too long. Please try again.",
) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new ApiError(504, message, "AGENT_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default withTimeout;
