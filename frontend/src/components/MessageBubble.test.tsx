import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import MessageBubble from "./MessageBubble";

describe("MessageBubble", () => {
  it("renders user message content", () => {
    renderWithProviders(<MessageBubble role="user" content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders assistant message with markdown", () => {
    renderWithProviders(<MessageBubble role="assistant" content="**bold text**" />);
    expect(screen.getByText("bold text")).toBeInTheDocument();
  });

  it("shows avatar icon for assistant messages", () => {
    renderWithProviders(<MessageBubble role="assistant" content="Hello" />);
    expect(screen.getByTestId("assistant-avatar")).toBeInTheDocument();
  });

  it("does not show avatar icon for user messages", () => {
    renderWithProviders(<MessageBubble role="user" content="Hello" />);
    expect(screen.queryByTestId("assistant-avatar")).toBeNull();
  });
});
