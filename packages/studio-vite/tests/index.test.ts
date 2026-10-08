import { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "@sugarcube-sh/vite";
import type { ResolvedConfig } from "vite";
import { describe, expect, it } from "vitest";
import sugarcubeStudio, { reloadingWith } from "../src/index";

function context() {
    const listeners: Array<() => void> = [];
    const ctx = {
        onReload: (fn: () => void) => {
            listeners.push(fn);
            return () => {};
        },
    } as unknown as SugarcubePluginContext;
    return { ctx, readAgain: () => listeners.forEach((fn) => fn()) };
}

function source() {
    let reloads = 0;
    return {
        source: { reloadTokens: async () => void (reloads += 1) } as never,
        reloads: () => reloads,
    };
}

function resolve(plugin: ReturnType<typeof reloadingWith>, plugins: unknown[]) {
    const warnings: string[] = [];
    const errors: string[] = [];
    const config = {
        plugins,
        logger: {
            warn: (message: string) => warnings.push(message),
            error: (message: string) => errors.push(message),
        },
    } as unknown as ResolvedConfig;
    (plugin.configResolved as (config: ResolvedConfig) => void)(config);
    return { warnings, errors };
}

describe("Studio's tokens under Vite", () => {
    it("reload whenever sugarcube's plugin reads the tokens again", () => {
        const { ctx, readAgain } = context();
        const { source: studio, reloads } = source();
        const plugin = reloadingWith(studio);

        const { warnings } = resolve(plugin, [
            { name: "vite:something" },
            { name: SUGARCUBE_API_PLUGIN_NAME, api: { getContext: () => ctx } },
        ]);
        readAgain();

        expect(reloads()).toBe(1);
        expect(warnings).toEqual([]);
        expect(plugin.apply).toBe("serve");
    });

    it("log a reload that fails, rather than leave it unhandled", async () => {
        const { ctx, readAgain } = context();
        const failing = {
            reloadTokens: () => Promise.reject(new Error("nothing to show")),
        } as never;

        const { errors } = resolve(reloadingWith(failing), [
            { name: SUGARCUBE_API_PLUGIN_NAME, api: { getContext: () => ctx } },
        ]);
        readAgain();
        await new Promise((done) => setTimeout(done, 0));

        expect(errors).toEqual(["[studio] nothing to show"]);
    });

    it("say why they never reload when sugarcube's plugin is not there", () => {
        const { source: studio } = source();

        const { warnings } = resolve(reloadingWith(studio), [{ name: "vite:something" }]);

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("@sugarcube-sh/vite");
    });
});

describe("what a host's Vite config gets", () => {
    it("is the reloading plugin and a devframes hub, nothing to configure", () => {
        const plugins = sugarcubeStudio();

        expect(plugins.map((plugin) => plugin.name)).toEqual([
            "sugarcube:studio:reload",
            "devframes:hub",
        ]);
    });
});
