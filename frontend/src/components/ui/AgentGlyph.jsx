import { agentById } from "../../lib/agents";
import { cx } from "../../lib/utils";

/** Distinct mini-robot heads: same chassis, per-agent visor and eye pattern. */
export default function AgentGlyph({ agentId = "chat", size = 22, className }) {
  const agent = agentById(agentId);
  const color = agent.color;
  const eyes = {
    chat: [17, 25],
    auto: [16.5, 25.5],
    search: [18, 24],
    coding: [17, 25],
    pdf: [19, 23],
    ppt: [17.5, 24.5],
    vision: [18.5, 23.5],
  };
  const [left, right] = eyes[agent.id] || eyes.chat;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 42 42"
      className={cx("shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M21 6v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="21" cy="5" r="1.9" fill={color} />
      <rect
        x="7"
        y="10"
        width="28"
        height="23"
        rx="8"
        fill="var(--tint-2)"
        stroke={color}
        strokeWidth="1.4"
      />
      <rect x="11" y="16" width="20" height="9" rx="4.5" fill="var(--code-bg)" opacity="0.92" />
      {agent.id === "pdf" ? (
        <>
          <rect x={left - 2} y="19" width="4" height="3" rx="1" fill={color} />
          <rect x={right - 2} y="19" width="4" height="3" rx="1" fill={color} opacity="0.5" />
        </>
      ) : agent.id === "coding" ? (
        <>
          <path d={`M${left - 1.5} 18.5l-2 2 2 2`} stroke={color} strokeWidth="1.3" fill="none" />
          <path d={`M${right + 1.5} 18.5l2 2-2 2`} stroke={color} strokeWidth="1.3" fill="none" />
        </>
      ) : (
        <>
          <circle cx={left} cy="20.5" r="2.2" fill={color} />
          <circle cx={right} cy="20.5" r="2.2" fill={color} />
        </>
      )}
      <path d="M17 28h8" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      <path
        d="M14 33v3M28 33v3"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
