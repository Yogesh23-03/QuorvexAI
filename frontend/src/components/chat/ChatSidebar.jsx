import { useMemo, useState } from "react";
import {
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "motion/react";
import GlowButton from "../ui/GlowButton";
import CreditsCard from "../billing/CreditsCard";
import { logout } from "../../features/auth";
import { resetConversationState } from "../../redux/messageSlice";
import { resetConversations } from "../../redux/conversationSlice";
import { setSidebarOpen } from "../../redux/uiSlice";
import { setUserdata } from "../../redux/userSlice";
import { cx, timeAgo, truncate } from "../../lib/utils";

export default function ChatSidebar({
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  collapsed,
  onToggleCollapse,
}) {
  const dispatch = useDispatch();
  const { conversations, selectedConversation } = useSelector((state) => state.conversation);
  const { userData } = useSelector((state) => state.user);
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) =>
      (conversation.title || "New Chat").toLowerCase().includes(term),
    );
  }, [conversations, query]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      dispatch(setUserdata(null));
      dispatch(resetConversations());
      dispatch(resetConversationState());
    }
  };

  if (collapsed) {
    return (
      <aside className="hidden h-full w-[64px] shrink-0 flex-col items-center gap-2 border-r border-line bg-void/50 py-4 backdrop-blur-xl lg:flex">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-tint-2 hover:text-ink"
        >
          <PanelLeftOpen size={16} />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New session"
          className="rounded-lg border border-neon/30 bg-neon/10 p-2 text-neon"
        >
          <Plus size={16} />
        </button>
        <div className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto scrollbar-none">
          {conversations.slice(0, 18).map((conversation) => (
            <button
              key={conversation._id}
              type="button"
              onClick={() => onSelectConversation(conversation)}
              title={conversation.title || "New Chat"}
              aria-label={`Open ${conversation.title || "New Chat"}`}
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                selectedConversation?._id === conversation._id
                  ? "bg-neon/15 text-neon"
                  : "bg-tint-1 text-ink-faint hover:text-ink",
              )}
            >
              <MessageSquare size={13} />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close conversation list"
          onClick={() => dispatch(setSidebarOpen(false))}
          className="fixed inset-0 top-16 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cx(
          "fixed bottom-0 left-0 top-16 z-50 flex w-[288px] max-w-[86vw] shrink-0 flex-col border-r border-line bg-void/95 backdrop-blur-2xl transition-transform duration-200",
          "lg:static lg:top-0 lg:z-auto lg:h-full lg:max-w-none lg:translate-x-0 lg:bg-void/50",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Conversations"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="hidden rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-tint-2 hover:text-ink lg:block"
          >
            <PanelLeftClose size={15} />
          </button>
          <span className="font-display text-[12px] font-semibold uppercase tracking-[0.2em] text-ink">
            Sessions
          </span>
          <span className="rounded-full bg-tint-2 px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
            {conversations.length}
          </span>
          <button
            type="button"
            onClick={() => dispatch(setSidebarOpen(false))}
            aria-label="Close conversation list"
            className="ml-auto rounded-lg p-1.5 text-ink-faint hover:text-ink lg:hidden"
          >
            <X size={15} />
          </button>
        </div>

        <div className="shrink-0 px-3 pt-3">
          <GlowButton fullWidth icon={PenSquare} onClick={onNewChat} size="sm">
            New session
          </GlowButton>

          <label className="mt-2.5 flex items-center gap-2 rounded-lg border border-line bg-tint-1 px-2.5 py-2">
            <Search size={13} className="text-ink-faint" aria-hidden="true" />
            <span className="sr-only">Search conversations</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sessions"
              className="w-full bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-slim">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              {query ? "No matching sessions" : "No sessions yet"}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conversation) => {
                const isActive = selectedConversation?._id === conversation._id;
                return (
                  <li key={conversation._id}>
                    <motion.div
                      layout
                      className={cx(
                        "group flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                        isActive
                          ? "border-neon/30 bg-neon/[0.08]"
                          : "border-transparent hover:bg-tint-2",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conversation)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className={cx(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                            isActive ? "bg-neon/15 text-neon" : "bg-tint-2 text-ink-faint",
                          )}
                        >
                          <MessageSquare size={12} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cx(
                              "block truncate text-[12.5px]",
                              isActive ? "text-ink" : "text-ink-soft",
                            )}
                          >
                            {truncate(conversation.title || "New Chat", 30)}
                          </span>
                          <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                            {timeAgo(conversation.updatedAt || conversation.createdAt)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conversation)}
                        aria-label={`Delete ${conversation.title || "New Chat"}`}
                        className="rounded-md p-1.5 text-ink-faint opacity-0 transition-all hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {userData && (
          <div className="shrink-0 space-y-2 border-t border-line p-3">
            <CreditsCard compact />

            <div className="flex items-center gap-2 rounded-xl border border-line bg-tint-1 px-2.5 py-2">
              {userData.avatar ? (
                <img
                  src={userData.avatar}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg border border-line object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint-2 text-ink-soft">
                  <User size={14} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-ink">
                  {userData.name || "Explorer"}
                </span>
                <span className="block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                  {userData.email}
                </span>
              </span>
              <Link
                to="/settings"
                aria-label="Settings and profile"
                className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-tint-2 hover:text-ink"
              >
                <Settings size={14} />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-tint-2 hover:text-danger"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
