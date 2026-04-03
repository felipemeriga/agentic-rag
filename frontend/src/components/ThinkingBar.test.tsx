// frontend/src/components/ThinkingBar.test.tsx
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import ThinkingBar from "./ThinkingBar";

describe("ThinkingBar", () => {
  it("renders nothing when stage is null", () => {
    const { container } = renderWithProviders(<ThinkingBar stage={null} />);
    expect(container.querySelector('[data-testid="thinking-bar"]')).toBeNull();
  });

  it('renders "Searching documents..." for searching stage', () => {
    renderWithProviders(<ThinkingBar stage={{ stage: "searching" }} />);
    expect(screen.getByText("Searching documents...")).toBeInTheDocument();
  });

  it("renders analyzing stage with doc count", () => {
    renderWithProviders(
      <ThinkingBar stage={{ stage: "analyzing", docs: 4 }} />
    );
    expect(screen.getByText("Analyzing 4 results...")).toBeInTheDocument();
    expect(screen.getByText("4 documents found")).toBeInTheDocument();
  });

  it('renders "Generating response..." for generating stage', () => {
    renderWithProviders(<ThinkingBar stage={{ stage: "generating" }} />);
    expect(screen.getByText("Generating response...")).toBeInTheDocument();
  });

  it("shows correct number of completed segments", () => {
    const { container } = renderWithProviders(
      <ThinkingBar stage={{ stage: "generating" }} />
    );
    const completedSegments = container.querySelectorAll(
      '[data-segment-status="completed"]'
    );
    const activeSegments = container.querySelectorAll(
      '[data-segment-status="active"]'
    );
    expect(completedSegments).toHaveLength(2);
    expect(activeSegments).toHaveLength(1);
  });
});
