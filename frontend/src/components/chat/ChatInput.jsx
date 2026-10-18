import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Mic, MicOff, Paperclip, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AGENTS } from "../../lib/agents";
import AgentGlyph from "../ui/AgentGlyph";
import { cx, humanFileSize, isImage, isPdf } from "../../lib/utils";
import { pushToast } from "../../redux/uiSlice";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 6;

export default function ChatInput({ onSend, disabled = false }) {
  const dispatch = useDispatch();
  const isLoading = useSelector((state) => state.message.isLoading);
  const [text, setText] = useState("");
  const [agent, setAgent] = useState("auto");
  const [file, setFile] = useState(null);
  const [listening, setListening] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-grow up to six rows, then scroll internally.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    const lineHeight = 22;
    node.style.height = `${Math.min(node.scrollHeight, lineHeight * MAX_ROWS + 16)}px`;
  }, [text]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setText(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const toggleMic = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      dispatch(
        pushToast({ tone: "info", message: "Voice input is not supported in this browser." }),
      );
      return;
    }
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  };

  const handleFile = (event) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (!isPdf(picked) && !isImage(picked)) {
      dispatch(pushToast({ tone: "error", message: "Only PDF and image files are supported." }));
      event.target.value = "";
      return;
    }
    if (picked.size > MAX_BYTES) {
      dispatch(pushToast({ tone: "error", message: "That file is larger than the 20MB limit." }));
      event.target.value = "";
      return;
    }
    setFile(picked);
  };

  const submit = () => {
    const prompt = text.trim();
    if (!prompt || isLoading || disabled) return;
    onSend?.({ text: prompt, agent, file });
    setText("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const canSend = text.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="sticky bottom-0 z-30 shrink-0 border-t border-line bg-void/85 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-5">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-line bg-panel/80 p-2.5 shadow-[var(--shadow-panel)] transition-colors focus-within:border-neon/45">
          <div
            role="group"
            aria-label="Choose an agent"
            className="scrollbar-none -mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-2"
          >
            {AGENTS.map((option) => {
              const isActive = agent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAgent(option.id)}
                  aria-pressed={isActive}
                  aria-label={`${option.label} agent, ${option.cost} credits`}
                  disabled={disabled}
                  title={option.hint}
                  style={isActive ? { borderColor: option.color } : undefined}
                  className={cx(
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
                    isActive
                      ? "bg-tint-2 text-ink"
                      : "border-line text-ink-soft hover:border-line-strong hover:text-ink",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <AgentGlyph agentId={option.id} size={14} />
                  <span>{option.label}</span>
                  <span className="text-ink-faint">{option.cost}c</span>
                </button>
              );
            })}
          </div>

          {file && (
            <div className="mb-2 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-line bg-tint-1 px-2.5 py-1.5">
              {isPdf(file) ? (
                <FileText size={15} className="shrink-0 text-danger" aria-hidden="true" />
              ) : (
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md object-cover"
                />
              )}
              <span className="min-w-0">
                <span className="block max-w-[180px] truncate text-[12px] text-ink">
                  {file.name}
                </span>
                <span className="block font-mono text-[10px] text-ink-faint">
                  {humanFileSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label="Remove attachment"
                className="rounded-md p-1 text-ink-faint hover:text-danger"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1.5">
            <div className="flex items-center gap-0.5">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFile}
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
                aria-label="Attach a PDF or image"
                className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-tint-2 hover:text-ink disabled:opacity-50"
              >
                <Paperclip size={16} />
              </button>
              <button
                type="button"
                onClick={toggleMic}
                disabled={disabled}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                aria-pressed={listening}
                className={cx(
                  "hidden rounded-lg p-2 transition-colors disabled:opacity-50 sm:block",
                  listening
                    ? "bg-danger/15 text-danger"
                    : "text-ink-faint hover:bg-tint-2 hover:text-ink",
                )}
              >
                {listening ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
            </div>

            <label className="sr-only" htmlFor="chat-prompt">
              Message QuorvexAI
            </label>
            <textarea
              id="chat-prompt"
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={disabled}
              aria-busy={isLoading}
              placeholder={
                isLoading ? "Quor is working…" : "Ask QuorvexAI anything — code, research, docs…"
              }
              className="min-h-[34px] w-full resize-none bg-transparent px-1 py-2 text-[14px] leading-[22px] text-ink outline-none placeholder:text-ink-faint scrollbar-slim disabled:opacity-60"
            />

            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              className={cx(
                "mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all",
                canSend
                  ? "bg-neon text-slate-950 shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--accent)_90%,transparent)] hover:brightness-110 active:translate-y-px"
                  : "cursor-not-allowed bg-tint-2 text-ink-faint",
              )}
            >
              <ArrowUp size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="mt-1.5 flex items-center justify-between px-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
          <span>{isLoading ? "agent running" : "enter to send · shift+enter newline"}</span>
          <span className="hidden sm:inline">100 credits reset every 5h</span>
        </p>
      </div>
    </div>
  );
}
