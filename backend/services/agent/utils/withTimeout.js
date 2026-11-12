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
        timer = setTimeout(() => {
          const error = new ApiError(504, message, "AGENT_TIMEOUT");
          // This message is written for the user; do not let the generic 5xx
          // handler replace it with "something went wrong".
          error.expose = true;
          reject(error);
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default withTimeout;
