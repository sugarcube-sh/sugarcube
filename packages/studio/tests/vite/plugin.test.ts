import { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "@sugarcube-sh/vite";
import type { ResolvedConfig } from "vite";
import { describe, expect, it, vi } from "vitest";
import sugarcubeStudio, { filesFromSugarcube } from "../../src/vite/plugin";

function context() {
    const listeners = new Set<() => void>();
    const ctx = {
        config: { resolver: "tokens/tokens.resolver.json", variables: {} },
        tokens: { files: ["tokens.resolver.json"] },
        configProblems: [],
        onReload: (fn: () => void) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    } as unknown as SugarcubePluginContext;
    return { ctx, readAgain: () => listeners.forEach((fn) => fn()) };
}

function resolve(plugin: ReturnType<typeof filesFromSugarcube>["plugin"], plugins: unknown[]) {
    const warnings: string[] = [];
    const config = {
        plugins,
        logger: { warn: (message: string) => warnings.push(message), error: () => {} },
    } as unknown as ResolvedConfig;
    (plugin.configResolved as (config: ResolvedConfig) => void)(config);
    return { warnings };
}

describe("studio's files under Vite", () => {
    it("are what sugarcube's plugin last read", async () => {
        const { ctx } = context();
        const { plugin, files } = filesFromSugarcube();

        const { warnings } = resolve(plugin, [
            { name: "vite:something" },
            { name: SUGARCUBE_API_PLUGIN_NAME, api: { getContext: () => ctx } },
        ]);

        expect((await files).now()).toBe(ctx);
        expect(warnings).toEqual([]);
        expect(plugin.apply).toBe("serve");
    });

    it("change whenever sugarcube's plugin reads the tokens again", async () => {
        const { ctx, readAgain } = context();
        const { plugin, files } = filesFromSugarcube();
        resolve(plugin, [{ name: SUGARCUBE_API_PLUGIN_NAME, api: { getContext: () => ctx } }]);
        const listener = vi.fn();

        (await files).onChange(listener);
        readAgain();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("say why studio never opens when sugarcube's plugin is not there", () => {
        const { plugin } = filesFromSugarcube();

        const { warnings } = resolve(plugin, [{ name: "vite:something" }]);

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/^\[sugarcube studio\] /);
        expect(warnings[0]).toContain("@sugarcube-sh/vite");
    });
});

describe("what a host's Vite config gets", () => {
    it("is the plugin that finds the files and a devframes hub, nothing to configure", () => {
        const plugins = sugarcubeStudio();

        expect(plugins.map((plugin) => plugin.name)).toEqual([
            "sugarcube:studio:files",
            "devframes:hub",
        ]);
    });
});
