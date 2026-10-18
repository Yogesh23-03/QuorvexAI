import { StateGraph, END } from "@langchain/langgraph";
import { agentState } from "./state.js";
import { router, ROUTABLE_AGENTS } from "./router.js";
import { chatAgent } from "../agents/chat.agent.js";
import { searchAgent } from "../agents/search.agent.js";
import { codingAgent } from "../agents/coding.agent.js";
import { pdfAgent } from "../agents/pdf.agent.js";
import { pptAgent } from "../agents/ppt.agent.js";
import { visionAgent } from "../agents/vision.agent.js";
import { pdfRag } from "../agents/pdfRag.agent.js";
import { imageAnalyzer } from "../agents/imageAnalyzer.agent.js";

const NODES = {
  chat: chatAgent,
  search: searchAgent,
  coding: codingAgent,
  pdf: pdfAgent,
  ppt: pptAgent,
  vision: visionAgent,
  pdfRag,
  imageAnalyzer,
};

function buildGraph() {
  const workflow = new StateGraph(agentState);

  workflow.addNode("router", router);
  Object.entries(NODES).forEach(([name, handler]) => workflow.addNode(name, handler));

  workflow.addEdge("__start__", "router");

  workflow.addConditionalEdges(
    "router",
    (state) => {
      const target = String(state.agent || "chat");
      if (target === "pdfRag" || target === "imageAnalyzer") return target;
      if (ROUTABLE_AGENTS.includes(target)) return target;
      return "chat";
    },
    {
      ...Object.fromEntries(Object.keys(NODES).map((name) => [name, name])),
    },
  );

  // Search enriches the prompt, then the chat agent writes the answer.
  workflow.addEdge("search", "chat");

  workflow.addEdge("chat", END);
  workflow.addEdge("coding", END);
  workflow.addEdge("pdf", END);
  workflow.addEdge("ppt", END);
  workflow.addEdge("vision", END);
  workflow.addEdge("pdfRag", END);
  workflow.addEdge("imageAnalyzer", END);

  return workflow.compile();
}

export const graph = buildGraph();
export default graph;
