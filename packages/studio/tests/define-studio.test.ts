import type { InternalConfig, TokenTree } from "@sugarcube-sh/core";
import { describe, expect, it, vi } from "vitest";
import { STUDIO_RPC } from "../src/protocol";
import { STUDIO_ROUTE, STUDIO_SURFACE, defineStudio } from "../src/server/define-studio";
import type {
    StudioHostBridge,
    StudioSaveBundle,
    StudioSharedState,
    StudioTokenSource,
} from "../src/server/types";
import { resolved } from "./fixtures";

type FakeState<T extends object> = StudioSharedState<T> & { value(): T };

function fakeState<T extends object>(initialValue: T): FakeState<T> {
    let current = initialValue;
    return {
        value: () => current,
        mutate: (fn) => {
            const draft = { ...current };
            fn(draft);
            current = draft;
        },
    };
}

const SOURCES = { files: { "color.json": "{}", "dark.json": "{}" }, order: [] };

function setup(overrides: Partial<StudioTokenSource> = {}) {
    const first = resolved({ path: "color.bg", value: "#fff" });
    let reloadHandler: (() => void) | undefined;

    const source: StudioTokenSource & { fire: { reload(): void } } = {
        ready: Promise.resolve(),
        config: { variables: {} } as InternalConfig,
        trees: [] as TokenTree[],
        resolved: first,
        defaultContext: null,
        permutations: [],
        sources: SOURCES,
        writeOps: vi.fn(async () => {}),
        reloadTokens: vi.fn(async () => {}),
        onReload: (fn) => {
            reloadHandler = fn;
        },
        fire: {
            reload: () => reloadHandler?.(),
        },
        ...overrides,
    };

    const states = new Map<string, FakeState<object>>();
    const actions = new Map<string, (...args: never[]) => Promise<void>>();
    const warnings: string[] = [];
    const configs: unknown[] = [];

    const host: StudioHostBridge = {
        sharedState: async (key, initialValue) => {
            const state = fakeState(initialValue);
            states.set(key, state);
            return state;
        },
        registerAction: (name, handler) => {
            actions.set(name, handler as unknown as (...args: never[]) => Promise<void>);
        },
        warn: (message) => warnings.push(message),
        publishConfig: (config) => {
            configs.push(config);
        },
    };

    const disk = () => states.get(STUDIO_RPC.SHARED_STATE_DISK)?.value() as Record<string, unknown>;
    const save = (files: StudioSaveBundle["files"]) =>
        actions.get(STUDIO_RPC.SAVE)?.({ title: "", description: "", files } as never);

    return { source, host, states, actions, warnings, configs, first, disk, save };
}

describe("defineStudio", () => {
    it("names the surface as data, leaving each host to mount it", () => {
        expect(STUDIO_SURFACE).toEqual({
            id: "sugarcube-studio",
            title: "Studio",
            route: STUDIO_ROUTE,
        });
    });

    it("bakes the save address into the handshake when a build names one", async () => {
        const s = setup();

        await defineStudio(s.source, s.host, { saveUrl: "https://example.test/submit-pr" });

        expect(s.configs).toEqual([{ saveUrl: "https://example.test/submit-pr" }]);
    });

    it("publishes nothing about saving when there is a server to save to", async () => {
        const s = setup();

        await defineStudio(s.source, s.host);

        expect(s.configs).toEqual([]);
    });

    it("seeds the disk state from the pipeline, with a copy of the config", async () => {
        const s = setup();

        await defineStudio(s.source, s.host);

        expect(s.states.size).toBe(1);
        expect(s.disk().resolved).toEqual(s.first);
        expect(s.disk().config).toEqual(s.source.config);
        expect(s.disk().config).not.toBe(s.source.config);
    });

    it("pushes disk state on reload", async () => {
        const s = setup();
        await defineStudio(s.source, s.host);

        const fromDisk = resolved({ path: "color.bg", value: "#111" });
        s.source.resolved = fromDisk;
        s.source.fire.reload();

        expect(s.disk()).toMatchObject({ resolved: fromDisk });
    });

    it("warns when the first load has nothing, and mounts on the first load that does", async () => {
        const s = setup({ resolved: null, errors: ["Invalid JSON in resolver file"] });
        await defineStudio(s.source, s.host);

        expect(s.warnings).toHaveLength(1);
        expect(s.warnings[0]).toContain("Invalid JSON in resolver file");
        expect(s.disk()).toEqual({});
        expect(s.actions.has(STUDIO_RPC.SAVE)).toBe(true);

        s.source.resolved = s.first;
        s.source.errors = [];
        s.source.fire.reload();

        expect(s.disk().resolved).toEqual(s.first);
    });

    it("keeps the last good state when a reload produces nothing, and says why", async () => {
        const s = setup();
        await defineStudio(s.source, s.host);

        s.source.sources = null;
        s.source.errors = ["Invalid JSON in resolver file"];
        s.source.fire.reload();

        expect(s.disk().resolved).toEqual(s.first);
        expect(s.warnings).toHaveLength(1);
        expect(s.warnings[0]).toContain("Invalid JSON in resolver file");
    });

    it("mounts a project whose config names variables with a function, and says the browser cannot", async () => {
        const s = setup({
            config: { variables: { variableName: (path: string) => `ds-${path}` } } as never,
        });

        await defineStudio(s.source, s.host);

        expect(s.disk().config).toEqual({ variables: {} });
        expect(s.warnings).toHaveLength(1);
        expect(s.warnings[0]).toContain("function");

        s.source.fire.reload();
        expect(s.warnings).toHaveLength(1);
    });

    it("hands every file's operations to the source in one call, so a save is all or nothing", async () => {
        const s = setup();
        await defineStudio(s.source, s.host);

        const files: StudioSaveBundle["files"] = [
            { path: "color.json", ops: [{ kind: "set", path: ["color", "bg"], value: "#000" }] },
            { path: "dark.json", ops: [{ kind: "set", path: ["color", "bg"], value: "#fff" }] },
        ];
        await s.save(files);

        expect(s.source.writeOps).toHaveBeenCalledTimes(1);
        expect(s.source.writeOps).toHaveBeenCalledWith(files);
    });

    it("refuses a save naming a file that was not loaded, before touching any", async () => {
        const s = setup();
        await defineStudio(s.source, s.host);

        await expect(
            s.save([
                { path: "color.json", ops: [{ kind: "set", path: ["x"], value: 1 }] },
                { path: "/etc/hosts", ops: [{ kind: "set", path: ["x"], value: 1 }] },
            ]),
        ).rejects.toThrow("/etc/hosts");

        expect(s.source.writeOps).not.toHaveBeenCalled();
    });

    it("folds two entries for one file into one, in order", async () => {
        const s = setup();
        await defineStudio(s.source, s.host);

        await s.save([
            { path: "color.json", ops: [{ kind: "set", path: ["x"], value: 1 }] },
            { path: "color.json", ops: [{ kind: "set", path: ["y"], value: 2 }] },
        ]);

        expect(s.source.writeOps).toHaveBeenCalledWith([
            {
                path: "color.json",
                ops: [
                    { kind: "set", path: ["x"], value: 1 },
                    { kind: "set", path: ["y"], value: 2 },
                ],
            },
        ]);
    });
});
