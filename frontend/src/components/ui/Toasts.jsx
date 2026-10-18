import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "motion/react";
import { dismissToast } from "../../redux/uiSlice";
import { cx } from "../../lib/utils";

const TONES = {
  success: { icon: CheckCircle2, ring: "border-lime/40", text: "text-lime" },
  error: { icon: AlertTriangle, ring: "border-rose-400/40", text: "text-rose-300" },
  info: { icon: Info, ring: "border-neon/40", text: "text-neon" },
};

function ToastItem({ toast }) {
  const dispatch = useDispatch();
  const tone = TONES[toast.tone] || TONES.info;
  const Icon = tone.icon;

  useEffect(() => {
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), toast.timeout || 6000);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id, toast.timeout]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className={cx(
        "glass-strong flex w-full items-start gap-3 rounded-xl border p-3.5",
        tone.ring,
      )}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <Icon size={16} className={cx("mt-0.5 shrink-0", tone.text)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className="font-display text-[12px] uppercase tracking-[0.14em] text-slate-200">
            {toast.title}
          </p>
        )}
        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-300">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dispatch(dismissToast(toast.id))}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-slate-500 transition-colors hover:bg-tint-3 hover:text-slate-200"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export default function Toasts() {
  const toasts = useSelector((state) => state.ui.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
