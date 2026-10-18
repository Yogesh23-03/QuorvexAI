import { agentById } from "../../lib/agents";
import AgentGlyph from "./AgentGlyph";
import { cx } from "../../lib/utils";

export default function AgentBadge({ agentId = "chat", size = "md", showHint = false, className }) {
  const agent = agentById(agentId);
  const small = size === "sm";

  return (
    <span className={cx("inline-flex flex-col gap-1", className)}>
      <span
        className={cx(
          "inline-flex items-center gap-1.5 rounded-md border border-line bg-tint-1 font-mono uppercase tracking-[0.16em] text-ink",
          small ? "px-2 py-0.5 text-[9.5px]" : "px-2.5 py-1 text-[10.5px]",
        )}
      >
        <AgentGlyph agentId={agent.id} size={small ? 14 : 17} />
        <span style={{ color: agent.color }}>{agent.label}</span>
        <span className="text-ink-faint">{agent.cost}c</span>
      </span>
      {showHint && <span className="text-[11px] text-ink-soft">{agent.hint}</span>}
    </span>
  );
}
