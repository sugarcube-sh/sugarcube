import { EventEmitter } from "node:events";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const { loadTokens, resolveTokens, loadInternalConfig } = vi.hoisted(() => ({
    loadTokens: vi.fn(),
    resolveTokens: vi.fn(),
    loadInternalConfig: vi.fn(),
}));

const config = {
    resolver: "tokens/tokens.resolver.json",
    variables: {
        path: "src/styles/tokens.css",
        transforms: {
            fluid: { min: 320, max: 1200 },
            colorFallbackStrategy: "native",
        },
    },
    utilities: {
        path: "src/styles/utilities.css",
        classes: {},
    },
    cube: "src/styles",
};

const resolved = {
    trees: [],
    resolved: {} as any,
    errors: { expandTree: [], flatten: [], validation: [], resolution: [] },
    warnings: [],
};

vi.mock("@sugarcube-sh/core", async () => {
    const actual = await vi.importActual<any>("@sugarcube-sh/core");
    return {
        ...actual,
        loadInternalConfig,
        loadTokens,
        resolveTokens,
        groupByContext: () => ({ default: {} }),
        assignCSSNames: () => ({ default: { default: {} } }),
        generateCSSVariables: async () => [{ css: "" }],
        convertConfigToUnoRules: () => [],
    };
});

import sugarcube, { extractTokenDirs } from "../src/index.js";

const loaded = {
    trees: [],
    errors: [],
    permutations: [{ name: "default", modifiers: {} }],
    sources: {
        files: { "/tokens/color.json": "{}" },
        order: [{ context: "default", sources: [{ file: "/tokens/color.json" }] }],
    },
    defaultContext: "default",
};

function healthy() {
    loadInternalConfig.mockResolvedValue({ config });
    loadTokens.mockResolvedValue(loaded);
    resolveTokens.mockReturnValue(resolved);
}

async function plugin(name: string) {
    const plugins = await sugarcube();
    return plugins.flat().find((p: any) => p.name === name);
}

async function context() {
    return (await plugin("sugarcube:api")).api.getContext();
}

function fakeServer() {
    return {
        watcher: new EventEmitter(),
        config: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, plugins: [] },
        moduleGraph: { getModuleById: () => undefined },
    };
}

function servedPage() {
    const uno = { invalidate: vi.fn(), reloadConfig: vi.fn(async () => {}) };
    return {
        uno,
        watcher: new EventEmitter(),
        config: {
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            plugins: [{ name: "unocss:api", api: { getContext: () => uno } }],
        },
        moduleGraph: {
            getModuleById: () => undefined,
            idToModuleMap: new Map(),
            urlToModuleMap: new Map(),
        },
    };
}

async function settle() {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
}

function unhandledRejections() {
    const seen: unknown[] = [];
    const listener = (reason: unknown) => seen.push(reason);
    process.on("unhandledRejection", listener);
    return { seen, stop: () => process.off("unhandledRejection", listener) };
}

describe("vite-plugin-sugarcube", () => {
    it("should return array of plugins with correct structure", async () => {
        healthy();
        const plugins = await sugarcube();
        expect(Array.isArray(plugins)).toBe(true);
        const flat = plugins.flat();
        expect(flat.every((p: any) => p.name)).toBe(true);
    });

    it("reports sources, permutations and defaultContext from loadTokens", async () => {
        healthy();
        const ctx = await context();
        expect(ctx.sources).toBe(loaded.sources);
        expect(ctx.permutations).toBe(loaded.permutations);
        expect(ctx.defaultContext).toBe("default");
    });

    it("reports null sources and defaultContext when loadTokens has none", async () => {
        healthy();
        loadTokens.mockResolvedValue({ trees: [], errors: [], permutations: [] });
        const ctx = await context();
        expect(ctx.sources).toBeNull();
        expect(ctx.defaultContext).toBeNull();
        expect(ctx.permutations).toEqual([]);
    });
});

describe("a reload that fails", () => {
    it("rejects for the caller and raises no unhandled rejection", async () => {
        healthy();
        const ctx = await context();
        const watch = unhandledRejections();
        resolveTokens.mockImplementationOnce(() => {
            throw new Error("boom");
        });

        await expect(ctx.reloadTokens()).rejects.toThrow("boom");
        await settle();
        watch.stop();

        expect(watch.seen).toEqual([]);
    });

    it("from a broken config file is logged, not thrown out of the watcher", async () => {
        healthy();
        const watcherPlugin = await plugin("sugarcube:config-watcher");
        const server = fakeServer();
        watcherPlugin.configureServer(server);
        const watch = unhandledRejections();
        loadInternalConfig.mockRejectedValueOnce(new Error("Unexpected token"));

        server.watcher.emit("change", "/app/sugarcube.config.ts");
        await settle();
        watch.stop();

        expect(watch.seen).toEqual([]);
        expect(server.config.logger.error).toHaveBeenCalledWith(
            expect.stringContaining("Unexpected token"),
        );
    });
});

describe("an edit on disk reaches the page", () => {
    const tokenFile = join(process.cwd(), "tokens", "color.json");

    it("refreshes UnoCSS's CSS after a token file changes", async () => {
        healthy();
        const watcherPlugin = await plugin("sugarcube:token-watcher");
        const server = servedPage();
        await watcherPlugin.configureServer(server);

        server.watcher.emit("change", tokenFile);
        await vi.waitFor(() => expect(server.uno.invalidate).toHaveBeenCalled());
    });

    it("refreshes UnoCSS's CSS after the config file changes", async () => {
        healthy();
        const watcherPlugin = await plugin("sugarcube:config-watcher");
        const server = servedPage();
        watcherPlugin.configureServer(server);

        server.watcher.emit("change", "/app/sugarcube.config.ts");
        await vi.waitFor(() => expect(server.uno.invalidate).toHaveBeenCalled());
        expect(server.uno.reloadConfig).toHaveBeenCalled();
    });

    it("says it is reloading once for a save that fires two change events", async () => {
        healthy();
        const watcherPlugin = await plugin("sugarcube:token-watcher");
        const server = servedPage();
        await watcherPlugin.configureServer(server);

        server.watcher.emit("change", tokenFile);
        server.watcher.emit("change", tokenFile);
        await vi.waitFor(() => expect(server.uno.invalidate).toHaveBeenCalled());

        const reloading = server.config.logger.info.mock.calls.filter(([message]) =>
            String(message).includes("Design tokens changed"),
        );
        expect(reloading).toHaveLength(1);
    });
});

describe("extractTokenDirs", () => {
    it("should return empty array when no resolver is set", () => {
        expect(extractTokenDirs({ resolver: undefined })).toEqual([]);
    });

    it("should return absolute directory for relative resolver path", () => {
        const dirs = extractTokenDirs({ resolver: "tokens/tokens.resolver.json" });
        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toMatch(/\/tokens$/);
        expect(dirs[0]).not.toContain("./");
    });

    it("should return absolute directory for ./ prefixed resolver path", () => {
        const dirs = extractTokenDirs({ resolver: "./tokens/tokens.resolver.json" });
        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toMatch(/\/tokens$/);
        expect(dirs[0]).not.toContain("./");
    });

    it("should produce consistent paths regardless of ./ prefix", () => {
        const withDot = extractTokenDirs({ resolver: "./tokens/tokens.resolver.json" });
        const withoutDot = extractTokenDirs({ resolver: "tokens/tokens.resolver.json" });
        expect(withDot).toEqual(withoutDot);
    });

    it("should handle resolver in project root", () => {
        const dirs = extractTokenDirs({ resolver: "tokens.resolver.json" });
        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toBe(process.cwd());
    });
});
