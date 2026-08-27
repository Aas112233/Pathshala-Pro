/**
 * Pathshala Pro Design Tokens
 * Central source of truth for all UI styling across the application
 * Used for consistent colors, spacing, typography, and component styling
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // Primary Colors - Education-focused blue
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6", // Main primary color
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },

  // Secondary Colors - Complementary green for success/positive actions
  secondary: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e", // Main secondary color
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#145231",
    950: "#0c2817",
  },

  // Neutral/Gray - For backgrounds, borders, and text
  neutral: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280", // Main neutral color
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },

  // Accent Colors
  accent: {
    amber: "#f59e0b",    // Warnings
    red: "#ef4444",      // Errors/Destructive
    cyan: "#06b6d4",     // Info
    purple: "#a855f7",   // Highlights
  },

  // Semantic Colors
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#06b6d4",
  destructive: "#ef4444",

  // Status Colors for School Context
  status: {
    active: "#22c55e",      // Student/Staff active
    inactive: "#9ca3af",    // Deactivated
    pending: "#f59e0b",     // Pending approval
    completed: "#3b82f6",   // Exam/Assignment complete
    failed: "#ef4444",      // Failed exam/attendance
    absent: "#ef4444",      // Student absent
    present: "#22c55e",     // Student present
    leave: "#f59e0b",       // On leave
  },

  // Backgrounds
  background: {
    primary: "#ffffff",
    secondary: "#f9fafb",
    tertiary: "#f3f4f6",
    muted: "#e5e7eb",
  },

  // Text Colors
  text: {
    primary: "#111827",
    secondary: "#4b5563",
    tertiary: "#9ca3af",
    inverse: "#ffffff",
    muted: "#d1d5db",
  },

  // Dark mode variants
  dark: {
    background: {
      primary: "#111827",
      secondary: "#1f2937",
      tertiary: "#374151",
    },
    text: {
      primary: "#f9fafb",
      secondary: "#d1d5db",
      tertiary: "#9ca3af",
    },
  },
};

// ============================================================================
// SPACING SCALE
// ============================================================================

export const spacing = {
  // Base unit: 4px
  xs: "4px",    // 0.25rem
  sm: "8px",    // 0.5rem
  md: "12px",   // 0.75rem
  lg: "16px",   // 1rem
  xl: "24px",   // 1.5rem
  "2xl": "32px", // 2rem
  "3xl": "40px", // 2.5rem
  "4xl": "48px", // 3rem
  "5xl": "64px", // 4rem
  "6xl": "80px", // 5rem

  // Page/Container spacing
  container: {
    xs: "20px",
    sm: "24px",
    md: "32px",
    lg: "40px",
  },

  // Gap spacing (between elements)
  gap: {
    tight: "8px",
    normal: "16px",
    loose: "24px",
    xl: "32px",
  },

  // Padding for different contexts
  padding: {
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "20px",
    xl: "24px",
    "2xl": "32px",
  },
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font families
  fonts: {
    default: "system-ui, -apple-system, sans-serif",
    mono: "Menlo, Monaco, Courier New, monospace",
  },

  // Font sizes
  sizes: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    md: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "28px",
    "4xl": "32px",
    "5xl": "36px",
  },

  // Line heights
  lineHeights: {
    tight: "1.2",
    normal: "1.5",
    relaxed: "1.75",
    loose: "2",
  },

  // Font weights
  weights: {
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },

  // Text styles (pre-defined combinations)
  styles: {
    h1: {
      size: "32px",
      weight: "700",
      lineHeight: "1.2",
      letterSpacing: "-0.5px",
    },
    h2: {
      size: "28px",
      weight: "700",
      lineHeight: "1.3",
      letterSpacing: "-0.25px",
    },
    h3: {
      size: "24px",
      weight: "600",
      lineHeight: "1.4",
    },
    h4: {
      size: "20px",
      weight: "600",
      lineHeight: "1.5",
    },
    body: {
      size: "16px",
      weight: "400",
      lineHeight: "1.5",
    },
    bodySm: {
      size: "14px",
      weight: "400",
      lineHeight: "1.5",
    },
    label: {
      size: "14px",
      weight: "500",
      lineHeight: "1.4",
    },
    caption: {
      size: "12px",
      weight: "500",
      lineHeight: "1.4",
    },
    captionXs: {
      size: "11px",
      weight: "500",
      lineHeight: "1.4",
    },
  },
};

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: "0",
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  full: "9999px",

  // Semantic
  button: "8px",
  card: "12px",
  modal: "12px",
  input: "6px",
  badge: "6px",
  avatar: "8px",
  table: "8px",
};

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  none: "none",
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",

  // Semantic
  card: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  modal: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  hover: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
};

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
  // Duration
  fast: "150ms",
  normal: "250ms",
  slow: "350ms",
  slower: "500ms",

  // Timing functions
  easing: {
    linear: "linear",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    easeOut: "cubic-bezier(0, 0, 0.2, 1)",
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },

  // Semantic transitions
  all: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
  color: "color 250ms cubic-bezier(0.4, 0, 0.2, 1)",
  opacity: "opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
};

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  xs: "320px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",

  // Mobile-first media queries
  mobile: "(min-width: 320px)",
  tablet: "(min-width: 768px)",
  desktop: "(min-width: 1024px)",
  wide: "(min-width: 1280px)",
};

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  hide: "-1",
  base: "0",
  dropdown: "1000",
  sticky: "1020",
  fixed: "1030",
  modal: "1040",
  popover: "1060",
  tooltip: "1070",
  notification: "1080",
  notification_top: "1090",
};

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================

export const components = {
  // Button tokens
  button: {
    height: {
      xs: "24px",
      sm: "28px",
      md: "32px",
      lg: "40px",
      xl: "48px",
    },
    padding: {
      xs: "4px 12px",
      sm: "6px 12px",
      md: "8px 16px",
      lg: "10px 20px",
      xl: "12px 24px",
    },
  },

  // Input tokens
  input: {
    height: {
      sm: "28px",
      md: "32px",
      lg: "40px",
    },
    padding: {
      sm: "4px 12px",
      md: "8px 12px",
      lg: "10px 16px",
    },
    borderRadius: "6px",
    borderWidth: "1px",
  },

  // Badge tokens
  badge: {
    padding: "4px 8px",
    height: "20px",
    fontSize: "12px",
  },

  // Card tokens
  card: {
    padding: {
      sm: "12px",
      md: "16px",
      lg: "20px",
      xl: "24px",
    },
    borderRadius: "12px",
    borderWidth: "1px",
  },

  // Modal tokens
  modal: {
    borderRadius: "12px",
    shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    backdropOpacity: "0.5",
  },

  // Table tokens
  table: {
    rowHeight: "40px",
    headerHeight: "48px",
    headerBg: "#f3f4f6",
    borderColor: "#e5e7eb",
    padding: "12px 16px",
  },

  // Sidebar tokens
  sidebar: {
    width: "256px",
    collapsedWidth: "80px",
    borderColor: "#e5e7eb",
  },

  // Header tokens
  header: {
    height: "56px",
    borderColor: "#e5e7eb",
  },
};

// ============================================================================
// SEMANTIC TOKENS (Context-aware)
// ============================================================================

export const semantic = {
  // Interactive states
  interactive: {
    default: colors.primary[500],
    hover: colors.primary[600],
    active: colors.primary[700],
    disabled: colors.neutral[300],
    focus: colors.primary[400],
  },

  // Form validation states
  validation: {
    valid: colors.secondary[500],
    invalid: colors.accent.red,
    warning: colors.accent.amber,
    info: colors.accent.cyan,
  },

  // Borders
  border: {
    light: colors.neutral[200],
    default: colors.neutral[300],
    dark: colors.neutral[400],
    focus: colors.primary[500],
    error: colors.accent.red,
  },

  // Backgrounds
  bg: {
    primary: colors.background.primary,
    secondary: colors.background.secondary,
    tertiary: colors.background.tertiary,
    muted: colors.background.muted,
    hover: colors.neutral[100],
    active: colors.primary[50],
  },

  // Overlays
  overlay: {
    light: "rgba(0, 0, 0, 0.25)",
    medium: "rgba(0, 0, 0, 0.5)",
    dark: "rgba(0, 0, 0, 0.75)",
  },
};

// ============================================================================
// OPACITY VALUES
// ============================================================================

export const opacity = {
  none: "0",
  xs: "0.05",
  sm: "0.1",
  md: "0.25",
  lg: "0.5",
  xl: "0.75",
  full: "1",

  // Semantic
  disabled: "0.5",
  hover: "0.1",
  focus: "1",
};

// ============================================================================
// ANIMATION
// ============================================================================

export const animations = {
  // Fade animations
  fadeIn: "fadeIn 300ms ease-out",
  fadeOut: "fadeOut 300ms ease-out",

  // Slide animations
  slideIn: "slideIn 300ms ease-out",
  slideOut: "slideOut 300ms ease-out",

  // Scale animations
  scaleIn: "scaleIn 200ms ease-out",
  scaleOut: "scaleOut 200ms ease-out",

  // Bounce animations
  bounce: "bounce 600ms ease-in-out",

  // Pulse animations
  pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",

  // Spin animations
  spin: "spin 1s linear infinite",
};

// ============================================================================
// THEME PRESETS
// ============================================================================

export const themes = {
  light: {
    colors: colors,
    background: colors.background.primary,
    foreground: colors.text.primary,
    primary: colors.primary[500],
    secondary: colors.secondary[500],
  },
  dark: {
    colors: colors,
    background: colors.dark.background.primary,
    foreground: colors.dark.text.primary,
    primary: colors.primary[400],
    secondary: colors.secondary[400],
  },
};

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Get a color by path, e.g., getColor("primary.500")
 */
export function getColor(path: string): string {
  const keys = path.split(".");
  let value: any = colors;

  for (const key of keys) {
    if (value && typeof value === "object") {
      value = value[key];
    } else {
      return "";
    }
  }

  return typeof value === "string" ? value : "";
}

/**
 * Create a CSS variable from a token
 */
export function createCSSVariable(name: string, value: string): string {
  return `--${name}: ${value};`;
}

/**
 * Generate all design tokens as CSS variables
 */
export function generateCSSVariables(): string {
  const variables: string[] = [":root {"];

  // Colors
  Object.entries(colors).forEach(([key, group]) => {
    if (typeof group === "object") {
      Object.entries(group).forEach(([subKey, value]) => {
        variables.push(`  --color-${key}-${subKey}: ${value};`);
      });
    }
  });

  // Spacing
  Object.entries(spacing).forEach(([key, value]) => {
    if (typeof value === "string") {
      variables.push(`  --spacing-${key}: ${value};`);
    }
  });

  // Typography
  Object.entries(typography.sizes).forEach(([key, value]) => {
    variables.push(`  --font-size-${key}: ${value};`);
  });

  Object.entries(typography.weights).forEach(([key, value]) => {
    variables.push(`  --font-weight-${key}: ${value};`);
  });

  // Shadows
  Object.entries(shadows).forEach(([key, value]) => {
    variables.push(`  --shadow-${key}: ${value};`);
  });

  // Border radius
  Object.entries(borderRadius).forEach(([key, value]) => {
    variables.push(`  --radius-${key}: ${value};`);
  });

  variables.push("}");

  return variables.join("\n");
}

const designTokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  zIndex,
  components,
  semantic,
  opacity,
  animations,
  themes,
};

export default designTokens;
