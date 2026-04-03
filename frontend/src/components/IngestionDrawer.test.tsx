import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import IngestionDrawer from "./IngestionDrawer";
import type { IngestionTask } from "../lib/api";

const mockTask: IngestionTask = {
  id: "1",
  user_id: "user1",
  filename: "report.pdf",
  folder_id: null,
  stage: "embedding",
  stage_detail: "Embedding 5/10",
  error_message: null,
  chunks_total: 10,
  chunks_done: 5,
  duplicate: false,
  document_ids: [],
  created_at: "2026-04-01",
  updated_at: "2026-04-01",
};

describe("IngestionDrawer", () => {
  it("renders task filename", () => {
    renderWithProviders(
      <IngestionDrawer
        open={true}
        tasks={[mockTask]}
        onClose={vi.fn()}
        onInteract={vi.fn()}
      />
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });

  it("renders stage detail text", () => {
    renderWithProviders(
      <IngestionDrawer
        open={true}
        tasks={[mockTask]}
        onClose={vi.fn()}
        onInteract={vi.fn()}
      />
    );
    expect(screen.getByText("Embedding 5/10")).toBeInTheDocument();
  });

  it("renders error message for failed tasks", () => {
    const failedTask: IngestionTask = {
      ...mockTask,
      stage: "error",
      error_message: "Parse error",
    };
    renderWithProviders(
      <IngestionDrawer
        open={true}
        tasks={[failedTask]}
        onClose={vi.fn()}
        onInteract={vi.fn()}
      />
    );
    expect(screen.getByText("Parse error")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderWithProviders(
      <IngestionDrawer
        open={false}
        tasks={[mockTask]}
        onClose={vi.fn()}
        onInteract={vi.fn()}
      />
    );
    expect(screen.queryByText("report.pdf")).toBeNull();
  });
});
