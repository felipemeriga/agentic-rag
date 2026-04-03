// frontend/src/components/DocumentCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import DocumentCard from "./DocumentCard";

const mockDoc = {
  source_filename: "report.pdf",
  source_type: "pdf",
  has_file: true,
  chunks: 24,
  status: "completed" as const,
  created_at: new Date().toISOString(),
  folder_id: null,
};

describe("DocumentCard", () => {
  it("renders filename", () => {
    renderWithProviders(
      <DocumentCard doc={mockDoc} onDelete={vi.fn()} onDownload={vi.fn()} />
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });

  it("renders chunk count", () => {
    renderWithProviders(
      <DocumentCard doc={mockDoc} onDelete={vi.fn()} onDownload={vi.fn()} />
    );
    expect(screen.getByText(/24 chunks/)).toBeInTheDocument();
  });

  it("renders status chip", () => {
    renderWithProviders(
      <DocumentCard
        doc={{ ...mockDoc, status: "processing" }}
        onDelete={vi.fn()}
        onDownload={vi.fn()}
      />
    );
    expect(screen.getByText("processing")).toBeInTheDocument();
  });

  it("renders completed status", () => {
    renderWithProviders(
      <DocumentCard doc={mockDoc} onDelete={vi.fn()} onDownload={vi.fn()} />
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});
