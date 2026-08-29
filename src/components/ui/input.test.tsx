import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Unified Input Component & Strict Number Field Protection", () => {
  afterEach(cleanup);

  it("renders a standard text input and allows typing text", () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Enter Name" onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Enter Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "John Doe" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("prevents letters and 'e' / 'E' keystrokes on type='number' input", () => {
    render(<Input type="number" placeholder="Enter Amount" />);

    const input = screen.getByPlaceholderText("Enter Amount") as HTMLInputElement;

    // Test letter 'a'
    const eventA = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    input.dispatchEvent(eventA);
    expect(eventA.defaultPrevented).toBe(true);

    // Test scientific notation 'e'
    const eventE = new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true });
    input.dispatchEvent(eventE);
    expect(eventE.defaultPrevented).toBe(true);

    // Test scientific notation 'E'
    const eventCapE = new KeyboardEvent("keydown", { key: "E", bubbles: true, cancelable: true });
    input.dispatchEvent(eventCapE);
    expect(eventCapE.defaultPrevented).toBe(true);

    // Test symbols like '$'
    const eventDollar = new KeyboardEvent("keydown", { key: "$", bubbles: true, cancelable: true });
    input.dispatchEvent(eventDollar);
    expect(eventDollar.defaultPrevented).toBe(true);
  });

  it("allows digits (0-9) and navigation keys on type='number' input", () => {
    render(<Input type="number" placeholder="Enter Amount" />);

    const input = screen.getByPlaceholderText("Enter Amount") as HTMLInputElement;

    // Test digit '5'
    const event5 = new KeyboardEvent("keydown", { key: "5", bubbles: true, cancelable: true });
    input.dispatchEvent(event5);
    expect(event5.defaultPrevented).toBe(false);

    // Test Backspace
    const eventBack = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    input.dispatchEvent(eventBack);
    expect(eventBack.defaultPrevented).toBe(false);

    // Test ArrowLeft
    const eventArrow = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true });
    input.dispatchEvent(eventArrow);
    expect(eventArrow.defaultPrevented).toBe(false);
  });
});
