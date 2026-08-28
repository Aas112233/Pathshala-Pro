import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Unified Button Component Loading & Protection", () => {
  afterEach(cleanup);

  it("renders children and handles onClick when not loading", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit Form</Button>);

    const btn = screen.getByRole("button", { name: /Submit Form/i }) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disables button, sets aria-busy, and blocks click events when loading is true", () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Save Changes
      </Button>
    );

    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");

    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders loadingText instead of children when loading is true and loadingText is provided", () => {
    render(
      <Button loading loadingText="Processing...">
        Save Changes
      </Button>
    );

    expect(screen.getByText("Processing...")).toBeTruthy();
    expect(screen.queryByText("Save Changes")).toBeNull();
  });
});
