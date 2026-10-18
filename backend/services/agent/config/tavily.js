import { TavilySearch } from "@langchain/tavily";
import { ApiError } from "../../../shared/errors.js";

let tool = null;

export function getSearchTool() {
  if (tool) return tool;
  if (!process.env.TAVILY_API_KEY) {
    throw new ApiError(503, "Web search is not configured", "SEARCH_NOT_CONFIGURED");
  }
  tool = new TavilySearch({
    maxResults: 5,
    topic: "general",
    includeImages: true,
  });
  return tool;
}

export default getSearchTool;
