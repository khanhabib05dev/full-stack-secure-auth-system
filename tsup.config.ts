// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/app.ts", "src/server.ts"],
  format: ["esm"],
  clean: true,
  dts: false,
  sourcemap: true,
  target: "node22",
  loader: {
    ".html": "copy",
  },
});