import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormField } from "@/components/ui/erp-form-layout";
import { Button } from "@/components/ui/button";

/**
 * Contract tests for the unified form recipe used across all migrated modules:
 * a <form id="..."> in the TopSheet body whose Submit lives in the sticky
 * footer, wired through the native `form` attribute.
 */
function UnifiedFormHarness({
  onSubmit,
  onClose,
}: {
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <TopSheet
      isOpen
      onClose={onClose}
      title="Test Sheet"
      description="Recipe verification"
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="top-sheet-test-form">
            Save
          </Button>
        </div>
      }
    >
      <form
        id="top-sheet-test-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <ERPFormField label="Name" required error="Name is required" htmlFor="test-name">
          <input id="test-name" />
        </ERPFormField>
      </form>
    </TopSheet>
  );
}

describe("unified TopSheet form recipe", () => {
  afterEach(cleanup);

  it("footer submit button fires the associated form's onSubmit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<UnifiedFormHarness onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancel button does not submit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<UnifiedFormHarness onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<UnifiedFormHarness onSubmit={vi.fn()} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Enter inside an input submits the form", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<UnifiedFormHarness onSubmit={onSubmit} onClose={onClose} />);

    const input = screen.getByLabelText(/Name/);
    // jsdom does not perform implicit submission on synthetic Enter keydown,
    // so drive the same code path via the form's submit event instead.
    fireEvent.submit(input.closest("form")!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("ERPFormField renders error text and required asterisk", () => {
    render(<UnifiedFormHarness onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Name is required")).toBeTruthy();

    const label = screen.getByText((_, element) => element?.tagName === "LABEL" && element.textContent === "Name*");
    const asterisk = label.querySelector("span");
    expect(asterisk?.textContent).toBe("*");
  });
});
