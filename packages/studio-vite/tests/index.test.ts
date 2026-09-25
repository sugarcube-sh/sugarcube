import { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "@sugarcube-sh/vite";
import type { ResolvedConfig } from "vite";
import { describe, expect, it } from "vitest";
import sugarcubeStudio, { capturePlugin, sourceFrom } from "../src/index";

function fakeContext(over: Partial<SugarcubePluginContext> = {}): SugarcubePluginContext {
    const listeners: Array<() => void> = [];
    return {
        ready: Promise.resolve(),
        config: { resolver: "tokens.resolver.json" } as never,
        trees: [],
        resolved: { "default.a": { $path: "a" } as never },
        defaultContext: "light",
        permutations: [],
        sources: { files: {}, order: [] },
        errors: [],
        reloadTokens: async () => {
            for (const fn of listeners) fn();
        },
        onReload: (fn) => {
            listeners.push(fn);
        },
        ...over,
    } as SugarcubePluginContext;
}

function resolvedConfig(plugins: Array<{ name: string; api?: unknown }>): ResolvedConfig {
    return { plugins } as unknown as ResolvedConfig;
}

describe("the Vite plugin's context as a token source", () => {
    it("holds nothing until the context is captured", () => {
        const { source } = sourceFrom();

        expect(source.config).toBeNull();
        expect(source.trees).toBeNull();
        expect(source.resolved).toBeNull();
        expect(source.sources).toBeNull();
        expect(source.permutations).toEqual([]);
        expect(source.errors).toEqual([]);
    });

    it("reads every field off the context once it is there", async () => {
        const { source, capture } = sourceFrom();
        const ctx = fakeContext();
        capture(ctx);
        await source.ready;

        expect(source.config).toBe(ctx.config);
        expect(source.trees).toBe(ctx.trees);
        expect(source.resolved).toBe(ctx.resolved);
        expect(source.defaultContext).toBe("light");
        expect(source.sources).toBe(ctx.sources);
        expect(source.errors).toEqual([]);
    });

    it("passes a reload through, listeners included", async () => {
        const { source, capture } = sourceFrom();
        capture(fakeContext());
        await source.ready;

        let reloads = 0;
        source.onReload(() => {
            reloads += 1;
        });
        await source.reloadTokens();

        expect(reloads).toBe(1);
    });

    it("passes on the errors the plugin's last load reported", async () => {
        const { source, capture } = sourceFrom();
        capture(fakeContext({ errors: ["Missing file a.json"] }));
        await source.ready;

        expect(source.errors).toEqual(["Missing file a.json"]);
    });

    it("says why when the sugarcube plugin is not there, and is ready anyway", async () => {
        const { source, capture } = sourceFrom();
        capture(null);
        await source.ready;

        expect(source.errors).toHaveLength(1);
        expect(source.errors?.[0]).toContain("@sugarcube-sh/vite");
        expect(source.config).toBeNull();
    });
});

describe("finding the sugarcube plugin", () => {
    it("takes the context off the plugin's api", () => {
        const ctx = fakeContext();
        let captured: SugarcubePluginContext | null | undefined;
        const plugin = capturePlugin((found) => {
            captured = found;
        });

        (plugin.configResolved as (config: ResolvedConfig) => void)(
            resolvedConfig([
                { name: "vite:something" },
                { name: SUGARCUBE_API_PLUGIN_NAME, api: { getContext: () => ctx } },
            ]),
        );

        expect(captured).toBe(ctx);
        expect(plugin.apply).toBe("serve");
    });

    it("captures null when no plugin has that name", () => {
        let captured: SugarcubePluginContext | null | undefined;
        const plugin = capturePlugin((found) => {
            captured = found;
        });

        (plugin.configResolved as (config: ResolvedConfig) => void)(
            resolvedConfig([{ name: "vite:something" }]),
        );

        expect(captured).toBeNull();
    });
});

describe("what a host's Vite config gets", () => {
    it("is the capture plugin and a devframes hub, nothing to configure", () => {
        const plugins = sugarcubeStudio();

        expect(plugins.map((plugin) => plugin.name)).toEqual([
            "sugarcube:studio:capture",
            "devframes:hub",
        ]);
    });
});
