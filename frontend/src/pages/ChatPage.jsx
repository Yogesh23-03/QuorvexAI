import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Menu, MessageSquare, Sparkles } from "lucide-react";
import ChatSidebar from "../components/chat/ChatSidebar";
import MessageList from "../components/chat/MessageList";
import ChatInput from "../components/chat/ChatInput";
import SandboxPanel from "../components/chat/SandboxPanel";
import StatusPill from "../components/ui/StatusPill";
import { ErrorState } from "../components/ui/StatePanel";
import {
  createConversation,
  deleteConversation,
  fetchMessages,
  listConversations,
  renameConversation,
} from "../features/conversations";
import { runAgent } from "../features/agent";
import {
  addConversation,
  removeConversation,
  setConversations,
  setConvTitle,
  setSelectedConversation,
} from "../redux/conversationSlice";
import {
  addMessage,
  resetConversationState,
  setArtifacts,
  setIsLoading,
  setMessageError,
  setMessages,
  setPendingAgent,
} from "../redux/messageSlice";
import { pushToast, setSidebarOpen, setBillingOpen } from "../redux/uiSlice";
import { setUserdata, updateCredits } from "../redux/userSlice";
import { fetchCurrentUser } from "../features/auth";
import { agentLabel } from "../lib/agents";

export default function ChatPage() {
  const dispatch = useDispatch();
  const { conversations, selectedConversation } = useSelector((state) => state.conversation);
  const { error } = useSelector((state) => state.message);
  const { userData } = useSelector((state) => state.user);
  const [collapsed, setCollapsed] = useState(false);
  const [listError, setListError] = useState(null);
  const [lastRequest, setLastRequest] = useState(null);
  const requestIdRef = useRef(0);

  const loadConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      dispatch(setConversations(data));
      setListError(null);
      return data;
    } catch (error_) {
      setListError(error_);
      dispatch(setConversations([]));
      return [];
    }
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await listConversations();
        if (!cancelled) {
          dispatch(setConversations(data));
          setListError(null);
        }
      } catch (error_) {
        if (!cancelled) {
          setListError(error_);
          dispatch(setConversations([]));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, userData?._id]);

  const openConversation = useCallback(
    async (conversation) => {
      // Wipe artifacts/messages first so the panel never shows the previous chat.
      dispatch(resetConversationState());
      dispatch(setSelectedConversation(conversation));
      dispatch(setSidebarOpen(false));

      if (!conversation) return;

      const token = ++requestIdRef.current;
      try {
        const messages = await fetchMessages(conversation._id);
        if (token !== requestIdRef.current) return;
        dispatch(setMessages(messages));
      } catch (error_) {
        if (token !== requestIdRef.current) return;
        dispatch(setMessageError(error_));
      }
    },
    [dispatch],
  );

  const handleNewChat = () => {
    requestIdRef.current += 1;
    dispatch(resetConversationState());
    dispatch(setSelectedConversation(null));
    dispatch(setSidebarOpen(false));
  };

  const handleDelete = async (conversation) => {
    try {
      await deleteConversation(conversation._id);
      dispatch(removeConversation(conversation._id));
      if (selectedConversation?._id === conversation._id) handleNewChat();
      dispatch(pushToast({ tone: "success", message: "Session deleted." }));
    } catch (error_) {
      dispatch(
        pushToast({ tone: "error", message: error_?.message || "Could not delete session." }),
      );
    }
  };

  const send = useCallback(
    async ({ text, agent, file }) => {
      setLastRequest({ text, agent, file });
      dispatch(setMessageError(null));
      dispatch(setIsLoading(true));
      dispatch(setPendingAgent(agent));

      try {
        let conversation = selectedConversation;

        if (!conversation) {
          conversation = await createConversation();
          dispatch(addConversation(conversation));
          dispatch(setSelectedConversation(conversation));
        }

        const needsTitle = !conversation.title || conversation.title === "New Chat";
        if (needsTitle) {
          const title = text.slice(0, 60);
          dispatch(setConvTitle({ conversationId: conversation._id, title }));
          renameConversation({ id: conversation._id, title }).catch(() => undefined);
        }

        dispatch(addMessage({ role: "user", content: text }));
        dispatch(setArtifacts([]));

        const result = await runAgent({
          prompt: text,
          conversationId: conversation._id,
          agent,
          file,
        });

        dispatch(
          addMessage({
            role: "assistant",
            content: result.answer,
            images: result.images,
            artifacts: result.artifacts,
            agent: result.agent || agent,
          }),
        );
        if (result.artifacts.length > 0) dispatch(setArtifacts(result.artifacts));

        if (typeof result.credits === "number") {
          dispatch(updateCredits({ credits: result.credits, totalCredits: result.totalCredits }));
        } else {
          const fresh = await fetchCurrentUser().catch(() => null);
          if (fresh) dispatch(setUserdata(fresh));
        }

        loadConversations();
      } catch (error_) {
        dispatch(setMessageError(error_));
        if (error_?.isCreditsError) {
          dispatch(setBillingOpen(true));
          dispatch(
            pushToast({
              tone: "error",
              title: "Out of credits",
              message: "Top up to keep running agents.",
            }),
          );
        } else if (error_?.isAuthError) {
          dispatch(pushToast({ tone: "error", message: "Session expired. Please sign in again." }));
        } else {
          dispatch(
            pushToast({
              tone: "error",
              title: `${agentLabel(agent)} agent failed`,
              message: error_?.message || "Please try again.",
            }),
          );
        }
      } finally {
        dispatch(setIsLoading(false));
      }
    },
    [dispatch, loadConversations, selectedConversation],
  );

  const retryLast = () => {
    if (!lastRequest) return;
    send(lastRequest);
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full overflow-hidden">
      <ChatSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onNewChat={handleNewChat}
        onSelectConversation={openConversation}
        onDeleteConversation={handleDelete}
      />

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-void/50 px-3.5 backdrop-blur-xl sm:px-5">
          <button
            type="button"
            onClick={() => dispatch(setSidebarOpen(true))}
            aria-label="Open conversation list"
            className="rounded-lg border border-line bg-tint-1 p-2 text-slate-300 lg:hidden"
          >
            <Menu size={15} />
          </button>

          <span className="grid h-7 w-7 place-items-center rounded-lg border border-neon/25 bg-neon/10 text-neon">
            <MessageSquare size={13} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              {selectedConversation?.title || "New session"}
            </h1>
            <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500">
              {conversations.length} sessions stored
            </p>
          </div>

          <StatusPill
            tone={userData ? "online" : "offline"}
            label={userData ? "AGENTS READY" : "OFFLINE"}
          />
        </header>

        {listError && (
          <div className="px-4 pt-4 sm:px-6">
            <ErrorState
              error={listError}
              title="Could not load your sessions"
              onRetry={() => loadConversations()}
            />
          </div>
        )}

        <MessageList
          onSuggestion={({ label, agent }) => {
            if (agent === "coding")
              dispatch(pushToast({ tone: "info", message: "Code agent ready — send to run." }));
            if (!selectedConversation) handleNewChat();
            send({ text: label, agent, file: null });
          }}
          onRetry={retryLast}
        />

        {(error || !userData) && null}

        <ChatInput onSend={send} />

        <span className="sr-only" aria-live="polite">
          <Sparkles size={12} /> Conversation area
        </span>
      </section>

      <SandboxPanel />
    </div>
  );
}
