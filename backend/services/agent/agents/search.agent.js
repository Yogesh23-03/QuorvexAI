import { getSearchTool } from "../config/tavily.js";
import { ApiError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";

export async function searchAgent(state) {
  try {
    const results = await getSearchTool().invoke({ query: state.prompt });

    const images = Array.isArray(results?.images)
      ? results.images.filter((image) => typeof image === "string").slice(0, 8)
      : Array.isArray(results?.results)
        ? results.results
            .map((item) => item?.images?.flat?.() || [])
            .flat()
            .filter((image) => typeof image === "string")
            .slice(0, 8)
        : [];

    return {
      ...state,
      searchResults: results,
      images,
    };
  } catch (error) {
    logger.error({ err: error.message }, "search agent failed");
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "Web search is unavailable right now. Please try again.",
      "SEARCH_FAILED",
    );
  }
}
