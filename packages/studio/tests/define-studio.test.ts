import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readOptions } from "@sugarcube-sh/core/client";
import { readFromMemory } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { createSession, setValue } from "@sugarcube-sh/dtcg-edit";
import { afterEach, describe, expect, it } from "vitest";
import type { StudioMessage } from "../src/protocol";
import { STUDIO_SURFACE, defineStudio } from "../src/server/define-studio";
import { STUDIO_DEVFRAME_ID, STUDIO_ROUTE, STUDIO_RPC } from "../src/studio-names";
import type { FilesNow, StudioFiles } from "../src/server/files";
import type { StudioHostBridge, StudioSharedState } from "../src/server/types";
import { configProblem, sugarcubeSettings } from "./controllers/demo-message";
import { demoCopy } from "./server/demo-copy";

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

let remove = () => {};
afterEach(() => remove());

async function setup(change: Partial<FilesNow> = {}) {
    const copy = demoCopy();
    remove = copy.remove;
    let now: FilesNow = {
        config: copy.config,
        tokens: await read(copy.config.resolver, readOptions(copy.config)),
        configProblems: [],
        ...change,
    };
    const listeners = new Set<() => void>();
    const files: StudioFiles = {
        now: () => now,
        onChange: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };

    const states = new Map<string, FakeState<object>>();
    const actions = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    const warnings: string[] = [];
    const configs: unknown[] = [];
    const host: StudioHostBridge = {
        sharedState: async (key, initialValue) => {
            const state = fakeState(initialValue);
            states.set(key, state);
            return state;
        },
        registerAction: (name, handler) => {
            actions.set(name, handler as (...args: unknown[]) => Promise<unknown>);
        },
        warn: (message) => warnings.push(message),
        publishConfig: (config) => {
            configs.push(config);
        },
    };

    return {
        ...copy,
        files,
        host,
        warnings,
        configs,
        message: () => states.get(STUDIO_RPC.MESSAGE)?.value() as StudioMessage,
        save: (sent: unknown) => actions.get(STUDIO_RPC.SAVE)?.(sent),
        change: (next: Partial<FilesNow>) => {
            now = { ...now, ...next };
            for (const listener of listeners) listener();
        },
    };
}

describe("defineStudio", () => {
    it("names the surface as data, leaving each host to mount it", () => {
        expect(STUDIO_SURFACE).toEqual({
            id: STUDIO_DEVFRAME_ID,
            title: "studio",
            route: STUDIO_ROUTE,
        });
    });

    it("bakes where the tokens live into the handshake when a build says, for studio to save to", async () => {
        const s = await setup();
        const gitSave = {
            host: "github",
            repository: "acme/site",
            branch: "main",
            entry: "tokens/tokens.resolver.json",
            signIn: "/api/sugarcube-studio",
        } as const;

        await defineStudio(s.files, s.host, { gitSave });

        expect(s.configs).toEqual([{ gitSave }]);
    });

    it("publishes nothing about saving when there is a server to save to", async () => {
        const s = await setup();

        await defineStudio(s.files, s.host);

        expect(s.configs).toEqual([]);
    });

    it("shares the files the host read, with the config and its problems", async () => {
        const s = await setup({ configProblems: [configProblem] });

        await defineStudio(s.files, s.host);

        expect(s.message().entry).toBe("tokens.resolver.json");
        expect(s.message().files["dark.json"]).toBe(readFileSync(join(s.dir, "dark.json"), "utf8"));
        expect(sugarcubeSettings(s.message()).resolver).toBe(s.config.resolver);
        expect(s.message().adapter.problems).toEqual([configProblem]);
    });

    it("shares the files again when the host reads them again", async () => {
        const s = await setup();
        await defineStudio(s.files, s.host);
        const edited = s.message().files["dark.json"]?.replace("50}", "100}") ?? "";

        s.change({
            tokens: s.files.now().tokens.rereadAll({ ...s.message().files, "dark.json": edited }),
        });

        expect(s.message().files["dark.json"]).toBe(edited);
    });

    it("warns once when the config names variables with a function", async () => {
        const s = await setup();
        const named = {
            ...s.config,
            variables: { ...s.config.variables, variableName: (path: string) => path },
        };
        s.change({ config: named });

        await defineStudio(s.files, s.host);
        s.change({});

        expect(s.warnings).toHaveLength(1);
        expect(s.warnings[0]).toContain("names variables with a function");
        expect(sugarcubeSettings(s.message()).variables.variableName).toBeUndefined();
    });

    it("saves edits sent from the browser to the files on disk", async () => {
        const s = await setup();
        await defineStudio(s.files, s.host);
        const session = createSession(
            readFromMemory(s.message(), readOptions(sugarcubeSettings(s.message()))),
        );
        session.do(
            setValue(session.tokens, "color.brand.500", {
                colorSpace: "oklch",
                components: [0.9, 0.05, 258],
            }),
        );

        const saved = await s.save(JSON.parse(JSON.stringify(session.unsaved)));

        expect(saved).toEqual({ written: ["color.json"], deleted: [] });
        expect(readFileSync(join(s.dir, "color.json"), "utf8")).toContain("0.9");
    });

    it("refuses to save what isn't edits", async () => {
        const s = await setup();
        await defineStudio(s.files, s.host);

        await expect(s.save({ title: "", files: [] })).rejects.toThrow(/^\[sugarcube studio\] /);
    });
});
