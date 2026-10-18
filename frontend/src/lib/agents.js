import { Code2, FileText, Globe, ImageIcon, MessageSquare, Presentation, Zap } from "lucide-react";

/**
 * Single source of truth for agent identity: label, icon, accent colour and
 * credit cost. `color` feeds the mini-robot glyphs so every surface matches.
 */
export const AGENTS = [
  {
    id: "auto",
    label: "Auto",
    icon: Zap,
    color: "var(--accent)",
    cost: 1,
    hint: "QuorvexAI picks the right agent for your prompt",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    color: "#FF6A2B",
    cost: 1,
    hint: "Conversation, explanations and reasoning",
  },
  {
    id: "search",
    label: "Search",
    icon: Globe,
    color: "#65A30D",
    cost: 5,
    hint: "Live web search with cited results",
  },
  {
    id: "coding",
    label: "Code",
    icon: Code2,
    color: "#2563EB",
    cost: 10,
    hint: "Multi-file projects with a live sandbox",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: FileText,
    color: "#DC2626",
    cost: 10,
    hint: "Structured documents, downloadable as PDF",
  },
  {
    id: "ppt",
    label: "PPT",
    icon: Presentation,
    color: "#D97706",
    cost: 10,
    hint: "Presentation decks generated as PPTX",
  },
  {
    id: "vision",
    label: "Vision",
    icon: ImageIcon,
    color: "#0D9488",
    cost: 10,
    hint: "Image generation from a text prompt",
  },
];

export const agentById = (id) => AGENTS.find((agent) => agent.id === id) || AGENTS[0];
export const agentLabel = (id) => agentById(id)?.label || "Auto";
