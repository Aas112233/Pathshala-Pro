import { describe, it, expect } from "vitest";
import designTokens, { getColor } from "@/lib/design-tokens";

describe("Design Tokens & System", () => {
  it("exports valid color tokens", () => {
    expect(designTokens.colors.primary[500]).toBe("var(--primary)");
    expect(getColor("primary.500")).toBe("var(--primary)");
    expect(designTokens.colors.secondary[500]).toBe("var(--secondary)");
  });

  it("exports valid typography and border radius tokens", () => {
    expect(designTokens.borderRadius.card).toBe("12px");
    expect(designTokens.typography.sizes.base).toBe("16px");
  });

  it("exports semantic component spacing", () => {
    expect(designTokens.spacing.gap.normal).toBe("16px");
    expect(designTokens.components.sidebar.width).toBe("256px");
  });
});
