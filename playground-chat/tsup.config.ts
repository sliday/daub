import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["iife"],
  globalName: "DaubChat",
  outDir: "../",
  outExtension: () => ({ js: ".playground-chat.js" }),
  splitting: false,
  sourcemap: true,
  minify: true,
  noExternal: [/.*/],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
