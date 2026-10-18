import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { store } from "../redux/store";
import ChatInput from "../components/chat/ChatInput";
import MessageBubble from "../components/chat/MessageBubble";

const renderWithStore = (ui) => render(<Provider store={store}>{ui}</Provider>);

describe("ChatInput", () => {
  it("sends the typed prompt with the selected agent", async () => {
    const onSend = vi.fn();
    renderWithStore(<ChatInput onSend={onSend} />);

    await userEvent.type(screen.getByLabelText(/message quorvexai/i), "build me a dashboard");
    await userEvent.click(screen.getByRole("button", { name: /^Code agent, 10 credits$/ }));
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(onSend).toHaveBeenCalledWith({
      text: "build me a dashboard",
      agent: "coding",
      file: null,
    });
  });

  it("submits on Enter but keeps Shift+Enter for new lines", async () => {
    const onSend = vi.fn();
    renderWithStore(<ChatInput onSend={onSend} />);
    const box = screen.getByLabelText(/message quorvexai/i);

    await userEvent.type(box, "hello{Shift>}{Enter}{/Shift}world");
    expect(onSend).not.toHaveBeenCalled();
    expect(box).toHaveValue("hello\nworld");

    await userEvent.type(box, "{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("disables sending when the prompt is empty", () => {
    renderWithStore(<ChatInput onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("exposes every agent chip with its credit cost", () => {
    renderWithStore(<ChatInput onSend={vi.fn()} />);

    [
      ["Auto", 1],
      ["Chat", 1],
      ["Search", 5],
      ["Code", 10],
      ["PDF", 10],
      ["PPT", 10],
      ["Vision", 10],
    ].forEach(([label, cost]) => {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^${label} agent, ${cost} credits$`),
        }),
      ).toBeInTheDocument();
    });
  });
});

describe("MessageBubble", () => {
  it("renders markdown content for assistant messages", () => {
    renderWithStore(
      <MessageBubble
        role="assistant"
        content={"## Deployment ready\n\nAll checks passed."}
        agent="coding"
      />,
    );

    expect(screen.getByRole("heading", { name: "Deployment ready" })).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
  });

  it("renders linked images as previews", () => {
    renderWithStore(
      <MessageBubble role="assistant" content="Here it is" images={["https://cdn.test/a.png"]} />,
    );

    expect(screen.getByRole("button", { name: /open image preview/i })).toBeInTheDocument();
  });
});
