import { fileURLToPath } from "node:url";
import type { InternalConfig } from "@sugarcube-sh/core";
import { STUDIO_RPC } from "../src/protocol";
import { describe, expect, it } from "vitest";
import { defineStudio } from "../src/server/define-studio";
import { createNodeTokenSource } from "../src/server/token-source";
import type { StudioHostBridge, StudioSharedState } from "../src/server/types";

const demoResolver = fileURLToPath(new URL("../demo/tokens.resolver.json", import.meta.url));

function demoConfig() {
    return async () => ({ resolver: demoResolver, variables: {} }) as InternalConfig;
}

function recordingBridge() {
    type FakeState = StudioSharedState<object> & { value(): unknown; emit(): void };
    const states = new Map<string, FakeState>();
    const actions = new Map<string, (...args: never[]) => Promise<void>>();
    const warnings: string[] = [];

    const bridge: StudioHostBridge = {
        sharedState: async (key, initialValue) => {
            let current = initialValue;
            const listeners: Array<() => void> = [];
            const state = {
                value: () => current,
                mutate: (fn: (draft: typeof initialValue) => void) => {
                    const draft = { ...current };
                    fn(draft);
                    current = draft;
                },
                on: (_event: "updated", fn: () => void) => listeners.push(fn),
                emit: () => {
                    for (const fn of listeners) fn();
                },
            };
            states.set(key, state as unknown as FakeState);
            return state;
        },
        registerAction: (name, handler) => {
            actions.set(name, handler as unknown as (...args: never[]) => Promise<void>);
        },
        warn: (message) => warnings.push(message),
    };

    return { bridge, states, actions, warnings };
}

describe("createNodeTokenSource", () => {
    it("loads and resolves real token files with no bundler involved", async () => {
        const source = createNodeTokenSource({ loadConfig: demoConfig() });
        await source.ready;

        expect(source.errors).toEqual([]);
        expect(source.trees?.length).toBeGreaterThan(0);
        expect(Object.keys(source.resolved ?? {}).length).toBeGreaterThan(0);
        expect(source.config?.resolver).toBe(demoResolver);
    });

    it("reports why it has nothing to show rather than throwing", async () => {
        const source = createNodeTokenSource({
            loadConfig: async () => ({ variables: {} }) as InternalConfig,
        });
        await source.ready;

        expect(source.resolved).toBeNull();
        expect(source.errors).toHaveLength(1);
    });

    it("applies operations to a token file without reformatting the rest", async () => {
        const written: Array<[string, string]> = [];
        const original = `{\n  "color": {\n    "bg": { "$value": "#fff" }\n  }\n}\n`;

        const source = createNodeTokenSource({
            loadConfig: demoConfig(),
            readFileText: async () => original,
            writeFileText: async (path, contents) => {
                written.push([path, contents]);
            },
        });
        await source.ready;

        await source.writeOps([
            {
                path: "color.json",
                ops: [{ kind: "set", path: ["color", "bg", "$value"], value: "#000" }],
            },
        ]);

        expect(written).toHaveLength(1);
        expect(written[0]?.[0]).toBe("color.json");
        expect(written[0]?.[1]).toContain(`"$value": "#000"`);
        expect(written[0]?.[1]).toContain(`"color": {`);
    });

    it("fires reload listeners after re-reading from disk", async () => {
        const source = createNodeTokenSource({ loadConfig: demoConfig() });
        await source.ready;

        let reloads = 0;
        source.onReload(() => {
            reloads += 1;
        });

        await source.reloadTokens();

        expect(reloads).toBe(1);
        expect(source.errors).toEqual([]);
    });
});

describe("a source that cannot load", () => {
    it("reports a config that fails to load as an error, and is ready anyway", async () => {
        const source = createNodeTokenSource({
            loadConfig: async () => {
                throw new Error("Unexpected token in sugarcube.config.ts");
            },
        });

        await source.ready;

        expect(source.errors).toEqual(["Unexpected token in sugarcube.config.ts"]);
        expect(source.trees).toBeNull();
    });

    it("keeps the last good load when a reload throws", async () => {
        let fail = false;
        const source = createNodeTokenSource({
            loadConfig: async () => {
                if (fail) throw new Error("gone");
                return demoConfig()();
            },
        });
        await source.ready;
        const trees = source.trees;

        fail = true;
        await source.reloadTokens();

        expect(source.trees).toBe(trees);
        expect(source.errors).toEqual(["gone"]);
    });

    it("runs one load at a time, collapsing calls that arrive during one", async () => {
        let inFlight = 0;
        let mostAtOnce = 0;
        let loads = 0;
        const source = createNodeTokenSource({
            loadConfig: async () => {
                loads += 1;
                inFlight += 1;
                mostAtOnce = Math.max(mostAtOnce, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 5));
                inFlight -= 1;
                return demoConfig()();
            },
        });
        await source.ready;

        await Promise.all([source.reloadTokens(), source.reloadTokens(), source.reloadTokens()]);

        expect(mostAtOnce).toBe(1);
        expect(loads).toBeLessThanOrEqual(3);
    });
});

describe("defineStudio on a filesystem source", () => {
    it("runs end to end with no Vite anywhere", async () => {
        const source = createNodeTokenSource({ loadConfig: demoConfig() });
        const host = recordingBridge();

        await defineStudio(source, host.bridge);

        expect(host.warnings).toEqual([]);
        expect(host.actions.has(STUDIO_RPC.SAVE)).toBe(true);

        const disk = host.states.get(STUDIO_RPC.SHARED_STATE_DISK)?.value() as {
            trees: unknown[];
            resolved: Record<string, unknown>;
        };

        expect(Object.keys(disk.resolved).length).toBeGreaterThan(0);
        expect(disk.trees.length).toBeGreaterThan(0);
    });

    it("saves through the definition into the source", async () => {
        const written: Array<[string, string]> = [];
        const source = createNodeTokenSource({
            loadConfig: demoConfig(),
            readFileText: async () => `{ "radius": { "md": { "$value": "0.25rem" } } }`,
            writeFileText: async (path, contents) => {
                written.push([path, contents]);
            },
        });
        const host = recordingBridge();

        await defineStudio(source, host.bridge);
        const radius = Object.keys(source.sources?.files ?? {}).find((path) =>
            path.endsWith("radius.json"),
        ) as string;
        await host.actions.get(STUDIO_RPC.SAVE)?.({
            files: [
                {
                    path: radius,
                    ops: [{ kind: "set", path: ["radius", "md", "$value"], value: "0.5rem" }],
                },
            ],
        } as never);

        expect(written).toHaveLength(1);
        expect(written[0]?.[1]).toContain("0.5rem");
    });
});
