import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Coins, LayoutGrid, LogOut, Menu, Settings, Sparkles, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "motion/react";
import Logo from "../ui/Logo";
import GlowButton from "../ui/GlowButton";
import StatusPill from "../ui/StatusPill";
import ThemeToggle from "../ui/ThemeToggle";
import { logout } from "../../features/auth";
import { resetConversations } from "../../redux/conversationSlice";
import { resetConversationState } from "../../redux/messageSlice";
import { pushToast, setBillingOpen } from "../../redux/uiSlice";
import { setUserdata } from "../../redux/userSlice";
import { cx, formatCredits } from "../../lib/utils";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/pricing", label: "Pricing" },
  { to: "/chat", label: "Command Center" },
];

export default function Navbar() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      dispatch(setUserdata(null));
      dispatch(resetConversations());
      dispatch(resetConversationState());
      setMenuOpen(false);
      dispatch(pushToast({ tone: "success", message: "Signed out. See you soon." }));
      navigate("/");
    }
  };

  const creditRatio = userData
    ? Math.min(100, Math.round(((userData.credits || 0) / (userData.totalCredits || 1)) * 100))
    : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-3 sm:gap-4 sm:px-6">
        {/* The logo's own text names this link; a different aria-label would
            break the label-in-name rule. */}
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav
          aria-label="Primary"
          className="ml-2 hidden items-center gap-0.5 md:flex lg:ml-4 lg:gap-1"
        >
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cx(
                  "rounded-lg px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors lg:px-3",
                  isActive ? "bg-tint-3 text-neon" : "text-slate-400 hover:text-slate-100",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <StatusPill className="hidden xl:inline-flex" />
          <ThemeToggle />

          {userData && (
            <button
              type="button"
              onClick={() => dispatch(setBillingOpen(true))}
              className="group flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-tint-1 px-2 py-1.5 transition-colors hover:border-neon/40 sm:gap-2 sm:px-3"
              aria-label={`Credits: ${formatCredits(userData.credits)} of ${formatCredits(userData.totalCredits)}. Open billing.`}
            >
              <Coins size={14} className="text-amber-300" aria-hidden="true" />
              <span className="font-mono text-[11px] text-slate-200">
                {formatCredits(userData.credits)}
              </span>
              {/* Decorative balance bar: hidden until there is room for it, so the
                  credits pill can never push the row past the viewport. */}
              <span className="relative hidden h-1.5 w-14 overflow-hidden rounded-full bg-tint-3 lg:block">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#FF6A2B,#2563EB)]"
                  style={{ width: `${creditRatio}%` }}
                />
              </span>
            </button>
          )}

          {userData ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-tint-1 p-1 transition-colors hover:border-neon/40 sm:pr-2.5"
              >
                {userData.avatar ? (
                  <img
                    src={userData.avatar}
                    alt=""
                    className="h-7 w-7 rounded-full border border-neon/30 object-cover"
                  />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-violet/20 text-violet">
                    <Sparkles size={13} />
                  </span>
                )}
                {/* The plan name only appears once the row has room for it; below
                    that it stays in the account menu. */}
                <span className="hidden max-w-[110px] truncate font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300 xl:inline">
                  {userData.plan || "free"}
                </span>
              </button>

              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-strong absolute right-0 mt-2 w-56 overflow-hidden rounded-xl p-1.5"
                  role="menu"
                >
                  <div className="border-b border-line px-3 py-2">
                    <p className="truncate text-[13px] font-medium text-slate-100">
                      {userData.name || "Explorer"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{userData.email}</p>
                  </div>
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-300 transition-colors hover:bg-tint-3 hover:text-slate-100"
                  >
                    <Settings size={14} /> Settings & profile
                  </Link>
                  <Link
                    to="/chat"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-300 transition-colors hover:bg-tint-3 hover:text-slate-100"
                  >
                    <LayoutGrid size={14} /> Command center
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-rose-300 transition-colors hover:bg-rose-500/10"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <GlowButton size="sm" variant="ghost" onClick={() => navigate("/login")}>
                Sign in
              </GlowButton>
              <GlowButton
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => navigate("/signup")}
              >
                Get started
              </GlowButton>
            </div>
          )}

          <button
            type="button"
            className="rounded-lg border border-line bg-tint-1 p-2 text-slate-300 md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile" className="border-t border-line px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      "block rounded-lg px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em]",
                      isActive ? "bg-tint-3 text-neon" : "text-slate-400",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
