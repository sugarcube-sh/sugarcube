import { fileURLToPath } from "node:url";
import type { SugarcubePluginContext } from "@sugarcube-sh/vite";
import sugarcube from "@sugarcube-sh/vite";
import presetWind3 from "@unocss/preset-wind3";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./src", import.meta.url));
const outDir = fileURLToPath(new URL("./dist/client", import.meta.url));

/**
 * Serves Studio's own resolved tokens at `<base>snapshot.json` for the
 * sandbox host (see src/host/sandbox-host.ts). Dev-server only - the shipped
 * bundle gets its tokens from a real host over RPC / postMessage.
 */
function sandboxSnapshot(): Plugin {
    return {
        name: "studio:sandbox-snapshot",
        apply: "serve",
        configureServer(server) {
            // configureServer middlewares run before Vite's base middleware,
            // so we match the raw base-prefixed URL and respond directly.
            server.middlewares.use(`${server.config.base}snapshot.json`, async (_req, res) => {
                try {
                    const plugin = server.config.plugins.find((p) => p.name === "sugarcube:api");
                    const ctx = (
                        plugin?.api as { getContext?: () => SugarcubePluginContext } | undefined
                    )?.getContext?.();

                    if (!ctx) {
                        res.statusCode = 503;
                        res.end(JSON.stringify({ error: "sugarcube plugin context not found" }));
                        return;
                    }

                    await ctx.ready;
                    const { config, trees, resolved } = ctx;
                    if (!config || !trees || !resolved) {
                        res.statusCode = 503;
                        res.end(JSON.stringify({ error: "sugarcube tokens not resolved yet" }));
                        return;
                    }

                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ config, trees, resolved }));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(
                        JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
                    );
                }
            });
        },
    };
}

export default defineConfig(({ mode }) => ({
    root,
    base: "/__studio/",
    // Fixed port so a host app (e.g. apps/www via `pnpm dev:studio`) can proxy
    // `/__studio/` here for live HMR of Studio's own source. strictPort fails
    // loudly rather than silently drifting to 5174 and breaking the proxy.
    server: {
        port: 5173,
        strictPort: true,
    },
    plugins: [
        react(),
        sugarcube({ unoOptions: { presets: [presetWind3({ preflight: false })] } }),
        sandboxSnapshot(),
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
    define:
        mode === "development"
            ? { "process.env.NODE_ENV": JSON.stringify("development") }
            : undefined,
}));
