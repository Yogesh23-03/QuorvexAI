import { Link } from "react-router-dom";
import { ExternalLink, Mail } from "lucide-react";
import Logo from "../ui/Logo";
import StatusPill from "../ui/StatusPill";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { to: "/chat", label: "Command center" },
      { to: "/pricing", label: "Pricing & credits" },
      { to: "/settings", label: "Settings" },
    ],
  },
  {
    title: "Agents",
    links: [
      { to: "/chat", label: "Chat & reasoning" },
      { to: "/chat", label: "Web search" },
      { to: "/chat", label: "Code sandbox" },
      { to: "/chat", label: "PDF, PPTX & images" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-line bg-void/60 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_repeat(2,1fr)_1.2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-400">
            A robotic multi-agent command center: six specialist agents orchestrated by LangGraph,
            with live code sandboxes and instant document exports.
          </p>
          <StatusPill className="mt-4" label="ALL SYSTEMS ONLINE" />
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon/80">
              {column.title}
            </h3>
            <ul className="mt-4 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-[13px] text-slate-400 transition-colors hover:text-slate-100"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon/80">
            Connect
          </h3>
          <ul className="mt-4 space-y-2">
            <li>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-slate-400 transition-colors hover:text-slate-100"
              >
                <ExternalLink size={14} aria-hidden="true" /> GitHub
              </a>
            </li>
            <li>
              <a
                href="mailto:hello@quorvex.ai"
                className="inline-flex items-center gap-2 text-[13px] text-slate-400 transition-colors hover:text-slate-100"
              >
                <Mail size={14} aria-hidden="true" /> hello@quorvex.ai
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line px-4 py-5 sm:px-6">
        <p className="mx-auto w-full max-w-[1400px] font-mono text-[10px] uppercase tracking-[0.22em] text-slate-600">
          © {new Date().getFullYear()} QuorvexAI — built with LangGraph, Redis and three.js
        </p>
      </div>
    </footer>
  );
}
