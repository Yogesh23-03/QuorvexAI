import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AICoreLoader from "../components/ui/AICoreLoader";
import { EmptyState, ErrorState } from "../components/ui/StatePanel";
import TypewriterText from "../components/fx/TypewriterText";
import { ApiRequestError } from "../lib/api";

describe("AICoreLoader", () => {
  it("exposes a polite live region", () => {
    render(<AICoreLoader label="Thinking" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Thinking");
  });
});

describe("ErrorState", () => {
  it("renders the message, trace id and retry action", async () => {
    const onRetry = vi.fn();
    const error = new ApiRequestError({ message: "Agent failed", status: 502, requestId: "req_9" });
    render(<ErrorState error={error} onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Agent failed");
    expect(screen.getByText(/req_9/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState", () => {
  it("renders a title and description", () => {
    render(<EmptyState title="No sessions" description="Start a new chat to begin." />);
    expect(screen.getByText("No sessions")).toBeInTheDocument();
    expect(screen.getByText("Start a new chat to begin.")).toBeInTheDocument();
  });
});

describe("TypewriterText", () => {
  it("renders the full text immediately when motion is reduced", () => {
    window.matchMedia = (query) => ({
      matches: query.includes("reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });

    render(<TypewriterText text="Booting QuorvexAI" />);
    expect(screen.getByTestId("typewriter")).toHaveTextContent("Booting QuorvexAI");
  });
});
