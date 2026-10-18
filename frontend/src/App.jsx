import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { AnimatePresence, motion } from "motion/react";
import BlueprintBackground from "./components/fx/BlueprintBackground";
import CursorGlow from "./components/fx/CursorGlow";
import Navbar from "./components/layout/Navbar";
import RouteGuard from "./components/layout/RouteGuard";
import BillingDrawer from "./components/billing/BillingDrawer";
import AICoreLoader from "./components/ui/AICoreLoader";
import Toasts from "./components/ui/Toasts";
import { fetchCurrentUser } from "./features/auth";
import { setAuthStatus, setUserdata } from "./redux/userSlice";
import { useReducedMotion } from "./lib/hooks";
import { cx } from "./lib/utils";

// Route-level code splitting keeps the first paint fast.
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const SignupPage = lazy(() => import("./pages/SignupPage.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] w-full place-items-center">
      <AICoreLoader label="Booting interface" />
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const reduced = useReducedMotion();
  const isChat = location.pathname === "/chat";

  useEffect(() => {
    let cancelled = false;
    dispatch(setAuthStatus("loading"));

    (async () => {
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) dispatch(setUserdata(user));
      } catch {
        if (!cancelled) dispatch(setUserdata(null));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return (
    <div
      className={cx(
        "relative flex w-full flex-col",
        isChat ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-neon focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:text-slate-950"
      >
        Skip to content
      </a>

      <BlueprintBackground />
      <CursorGlow />
      <Navbar />
      <Toasts />
      <BillingDrawer />

      <main
        id="main"
        className={cx("relative flex min-h-0 flex-1 flex-col", !isChat && "overflow-x-clip")}
      >
        <Suspense fallback={<RouteFallback />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className={cx("flex min-h-0 w-full flex-1 flex-col", !isChat && "pb-0")}
            >
              <Routes location={location}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route
                  path="/chat"
                  element={
                    <RouteGuard>
                      <ChatPage />
                    </RouteGuard>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RouteGuard>
                      <SettingsPage />
                    </RouteGuard>
                  }
                />
                <Route path="/dashboard" element={<Navigate to="/chat" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
}
