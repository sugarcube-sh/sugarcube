import { fileURLToPath } from "node:url";
import sugarcube from "@sugarcube-sh/vite";
import presetWind3 from "@unocss/preset-wind3";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { demoStudio } from "./src/dev/demo";

const root = fileURLToPath(new URL(".", import.meta.url));
const outDir = fileURLToPath(new URL("./dist/client", import.meta.url));

export default defineConfig(({ command, mode }) => ({
    root,
    base: "./",
    server: {
        port: 5173,
        strictPort: true,
    },
    plugins: [
        react(),
        sugarcube({ unoOptions: { presets: [presetWind3({ preflight: false })] } }),
        ...demoStudio(),
    ],
    build: {
        outDir,
        emptyOutDir: true,
        // Seems that `vite build` minifies by default. This is annoying in development so we disable it.
        minify: mode !== "development",
    },
    test: {
        root: fileURLToPath(new URL(".", import.meta.url)),
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
    // Similar to above: `vite build` pins NODE_ENV to "production" regardless of --mode,
    // which bundles react.production.min.js and disables React DevTools'
    // Profiler. Override it in development so `dev:client` produces a
    // debuggable bundle.
    define: {
        ...(mode === "development"
            ? { "process.env.NODE_ENV": JSON.stringify("development") }
            : {}),
        // The app is served at the root here; the bridge answers at its own base.
        "import.meta.env.VITE_STUDIO_RPC_BASE": JSON.stringify(
            command === "serve" ? "/__studio/" : "",
        ),
    },
}));
