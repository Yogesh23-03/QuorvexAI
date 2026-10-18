import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlassCard from "../components/ui/GlassCard";
import GlowButton from "../components/ui/GlowButton";
import AgentBadge from "../components/ui/AgentBadge";
import StatusPill from "../components/ui/StatusPill";
import HudFrame from "../components/ui/HudFrame";
import Logo from "../components/ui/Logo";

describe("GlassCard", () => {
  it("renders children inside a glass surface", () => {
    render(<GlassCard>Panel body</GlassCard>);
    const card = screen.getByText("Panel body");
    expect(card).toBeInTheDocument();
    expect(card.className).toMatch(/glass/);
  });

  it("adds HUD corner brackets when requested", () => {
    render(<GlassCard hud>HUD panel</GlassCard>);
    expect(screen.getByText("HUD panel").className).toMatch(/hud-corners/);
  });
});

describe("GlowButton", () => {
  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<GlowButton onClick={onClick}>Run agent</GlowButton>);
    await userEvent.click(screen.getByRole("button", { name: "Run agent" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables itself while loading", () => {
    render(<GlowButton loading>Running</GlowButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("AgentBadge", () => {
  it("shows the agent label and its credit cost", () => {
    render(<AgentBadge agentId="coding" />);
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("10c")).toBeInTheDocument();
  });

  it("falls back to auto for an unknown agent", () => {
    render(<AgentBadge agentId="unknown" />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });
});

describe("StatusPill", () => {
  it("announces its label", () => {
    render(<StatusPill label="AGENTS READY" />);
    expect(screen.getByRole("status")).toHaveTextContent("AGENTS READY");
  });
});

describe("HudFrame", () => {
  it("renders a labelled frame", () => {
    render(
      <HudFrame label="credits" hint="free">
        42
      </HudFrame>,
    );
    expect(screen.getByText("credits")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

describe("Logo", () => {
  it("exposes an accessible brand mark", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: /quorvexai logo/i })).toBeInTheDocument();
    expect(screen.getByText(/QUORVEX/)).toBeInTheDocument();
  });
});
