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

import sugarcube, { SUGARCUBE_API_PLUGIN_NAME, extractTokenDirs } from "../src/index.js";

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
    return (await sugarcubeWithUno()).named(name);
}

async function context() {
    return (await sugarcubeWithUno()).ctx;
}

async function sugarcubeWithUno() {
    const plugins = (await sugarcube()).flat();
    const named = (name: string) => plugins.find((p: any) => p.name === name);
    const uno = named("unocss:api").api.getContext();
    vi.spyOn(uno, "invalidate").mockImplementation(() => {});
    vi.spyOn(uno, "reloadConfig").mockResolvedValue(undefined);
    const ctx = named(SUGARCUBE_API_PLUGIN_NAME).api.getContext();
    return { named, uno, ctx };
}

function fakeServer() {
    return {
        watcher: new EventEmitter(),
        config: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, plugins: [] },
        moduleGraph: { getModuleById: () => undefined },
    };
}

function servedPage() {
    return {
        watcher: new EventEmitter(),
        config: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, plugins: [] },
        moduleGraph: { idToModuleMap: new Map(), urlToModuleMap: new Map() },
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

describe("the context", () => {
    it("reports the load's errors, one message each", async () => {
        healthy();
        loadTokens.mockResolvedValue({ ...loaded, errors: [{ message: "Missing file a.json" }] });
        const ctx = await context();
        expect(ctx.errors).toEqual(["Missing file a.json"]);
    });

    it("stops calling a reload listener once it unsubscribes", async () => {
        healthy();
        const ctx = await context();
        const listener = vi.fn();
        const unsubscribe = ctx.onReload(listener);

        await ctx.reloadTokens();
        unsubscribe();
        await ctx.reloadTokens();

        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("a change reaches the page", () => {
    const tokenFile = join(process.cwd(), "tokens", "color.json");

    it("refreshes UnoCSS's CSS after a token reload started through the context", async () => {
        healthy();
        const { ctx, uno } = await sugarcubeWithUno();

        await ctx.reloadTokens();

        expect(uno.invalidate).toHaveBeenCalled();
    });

    it("reloads UnoCSS's config, then refreshes its CSS, after a config reload started through the context", async () => {
        healthy();
        const { ctx, uno } = await sugarcubeWithUno();

        await ctx.reloadConfig();

        expect(uno.reloadConfig).toHaveBeenCalled();
        expect(uno.invalidate).toHaveBeenCalled();
    });

    it("refreshes UnoCSS's CSS after a token file changes", async () => {
        healthy();
        const { named, uno } = await sugarcubeWithUno();
        const server = servedPage();
        await named("sugarcube:token-watcher").configureServer(server);

        server.watcher.emit("change", tokenFile);

        await vi.waitFor(() => expect(uno.invalidate).toHaveBeenCalled());
    });

    it("still refreshes after a second, short-lived server starts, as Astro's content sync does", async () => {
        healthy();
        const { named, uno } = await sugarcubeWithUno();
        const devServer = servedPage();
        const syncServer = servedPage();
        await named("sugarcube:token-watcher").configureServer(devServer);
        await named("sugarcube:token-watcher").configureServer(syncServer);
        named("sugarcube:config-watcher").configureServer(syncServer);

        devServer.watcher.emit("change", tokenFile);

        await vi.waitFor(() => expect(uno.invalidate).toHaveBeenCalled());
    });

    it("reloads UnoCSS's config and refreshes its CSS after the config file changes", async () => {
        healthy();
        const { named, uno } = await sugarcubeWithUno();
        const server = servedPage();
        named("sugarcube:config-watcher").configureServer(server);

        server.watcher.emit("change", "/app/sugarcube.config.ts");

        await vi.waitFor(() => expect(uno.invalidate).toHaveBeenCalled());
        expect(uno.reloadConfig).toHaveBeenCalled();
    });

    it("says it is reloading once for a save that fires two change events", async () => {
        healthy();
        const { named, uno } = await sugarcubeWithUno();
        const server = servedPage();
        await named("sugarcube:token-watcher").configureServer(server);

        server.watcher.emit("change", tokenFile);
        server.watcher.emit("change", tokenFile);
        await vi.waitFor(() => expect(uno.invalidate).toHaveBeenCalled());

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
