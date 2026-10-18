import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import MessageBubble from "./MessageBubble";
import AICoreLoader from "../ui/AICoreLoader";
import AgentBadge from "../ui/AgentBadge";
import GlowButton from "../ui/GlowButton";
import RobotMascot from "../robot/RobotMascot";
import { ErrorState } from "../ui/StatePanel";
import { agentById } from "../../lib/agents";
import { clearMessageError } from "../../redux/messageSlice";
import { useReducedMotion } from "../../lib/hooks";
import { cx } from "../../lib/utils";

const SUGGESTIONS = [
  { label: "Build a working calculator app", agent: "coding" },
  { label: "Explain Redis streams in depth", agent: "chat" },
  { label: "What shipped in AI this week?", agent: "search" },
  { label: "Draft a launch deck for my startup", agent: "ppt" },
];

export default function MessageList({ onSuggestion, onRetry }) {
  const dispatch = useDispatch();
  const reduced = useReducedMotion();
  const { messages, isLoading, pendingAgent, error } = useSelector((state) => state.message);
  const { selectedConversation } = useSelector((state) => state.conversation);
  const scrollerRef = useRef(null);
  const bottomRef = useRef(null);
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const handleScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const pinned = distance < 120;
    pinnedRef.current = pinned;
    setShowJump(distance > 240);
  }, []);

  // Only follow new messages when the reader is already at the bottom.
  useEffect(() => {
    if (!pinnedRef.current) return;
    const frame = requestAnimationFrame(() => {
      const node = scrollerRef.current;
      if (!node) return;
      node.scrollTo({
        top: node.scrollHeight,
        behavior: reduced ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, isLoading, reduced]);

  const jumpToBottom = () => {
    const node = scrollerRef.current;
    if (!node) return;
    pinnedRef.current = true;
    setShowJump(false);
    node.scrollTo({ top: node.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  };

  if (!selectedConversation && messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 scrollbar-slim sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 text-center">
          <RobotMascot state="idle" glyphSize={104} showBody={false} />
          <div>
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
              Quorvex<span className="text-neon">AI</span> command center
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
              Pick a specialist or let Auto route the request. Six agents are standing by.
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => onSuggestion?.(suggestion)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-line bg-tint-1 p-3.5 text-left transition-colors hover:border-neon/35 hover:bg-tint-2"
              >
                <AgentBadge agentId={suggestion.agent} size="sm" />
                <span className="text-[13px] text-ink-soft group-hover:text-ink">
                  {suggestion.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeAgent = agentById(pendingAgent || "auto");

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain px-3 py-5 scrollbar-slim sm:px-6"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles size={20} className="text-neon" aria-hidden="true" />
              <p className="text-[13px] text-ink-soft">
                This session is empty. Send the first message to start.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble
              key={message._id || `${message.role}-${index}`}
              role={message.role}
              content={message.content}
              images={message.images || []}
              artifacts={message.artifacts || []}
              agent={message.role === "assistant" ? message.agent : undefined}
            />
          ))}

          {isLoading && (
            <div className="flex items-center gap-3">
              <RobotMascot state="thinking" glyphSize={44} showBody={false} />
              <AICoreLoader
                sublabel={`${activeAgent.label} agent is working — ${activeAgent.cost} credits`}
              />
            </div>
          )}

          {error && <ErrorState error={error} onRetry={onRetry} />}

          {error && (
            <div className="flex justify-center">
              <GlowButton
                size="sm"
                variant="ghost"
                icon={Sparkles}
                onClick={() => dispatch(clearMessageError())}
              >
                Dismiss
              </GlowButton>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <button
        type="button"
        onClick={jumpToBottom}
        aria-label="Scroll to newest message"
        className={cx(
          "absolute bottom-4 left-1/2 z-20 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-panel/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink shadow-[var(--shadow-panel)] backdrop-blur-md transition-all",
          showJump ? "flex" : "pointer-events-none opacity-0",
        )}
      >
        <ArrowDown size={13} /> Newest
      </button>
    </div>
  );
}
