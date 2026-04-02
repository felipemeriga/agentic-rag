// frontend/src/components/ContextPanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/renderWithProviders";
import ContextPanel from "./ContextPanel";
import type { Conversation } from "../lib/api";

const mockConversations: Conversation[] = [
  { id: "1", title: "First chat", created_at: "2026-04-01", updated_at: "2026-04-01" },
  { id: "2", title: "Second chat", created_at: "2026-04-01", updated_at: "2026-04-01" },
];

describe("ContextPanel", () => {
  it("renders conversation list when activePage is chat", () => {
    renderWithProviders(
      <ContextPanel
        activePage="/"
        open={true}
        conversations={mockConversations}
        selectedConversationId="1"
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
      />
    );
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.getByText("Second chat")).toBeInTheDocument();
  });

  it("renders new chat button that fires callback", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    renderWithProviders(
      <ContextPanel
        activePage="/"
        open={true}
        conversations={[]}
        selectedConversationId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={onNew}
        onDeleteConversation={vi.fn()}
      />
    );
    await user.click(screen.getByTestId("new-chat-button"));
    expect(onNew).toHaveBeenCalled();
  });

  it("does not render when closed", () => {
    const { container } = renderWithProviders(
      <ContextPanel
        activePage="/"
        open={false}
        conversations={[]}
        selectedConversationId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
      />
    );
    expect(container.querySelector('[data-testid="context-panel"]')).toBeNull();
  });
});
