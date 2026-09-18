import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests must never run against production React builds (strips React.act, dev warnings).
// Override a leaked NODE_ENV=production from the host shell before vitest reads it.
process.env.NODE_ENV = "test";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/.claude/**", "**/node_modules/**", "**/dist/**", "**/cypress/**"],
  },
});
