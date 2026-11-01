import { describe, expect, it } from "vitest";
import {
    type ColorValue,
    type DesignTokens,
    type Move,
    defineGenerator,
    readFromMemory,
    isEquivalentValue,
} from "../../src/index.js";

const resolver = JSON.stringify({
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }] } },
    modifiers: {
        theme: { contexts: { light: [], dark: [{ $ref: "dark.json" }] }, default: "light" },
    },
    resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }],
});

const px = (value: number) => ({ $value: { value, unit: "px" } });

const base = {
    space: {
        $type: "dimension",
        $description: "Gaps",
        sm: px(4),
        md: px(8),
        gap: { $value: "{space.sm}" },
    },
    typography: {
        $type: "dimension",
        body: px(16),
        heading: px(24),
    },
    text: { $type: "dimension", size: { $value: "{typography.body}" } },
};

const dark = { space: { md: px(10) } };

const light = { theme: "light" };
const darkTheme = { theme: "dark" };

function read(edit: { base?: object; dark?: object; more?: Record<string, string> } = {}) {
    return readFromMemory({
        files: {
            "tokens.resolver.json": resolver,
            "base.json": JSON.stringify(edit.base ?? base),
            "dark.json": JSON.stringify(edit.dark ?? dark),
            ...edit.more,
        },
    });
}

function changed(path: (string | number)[], value: unknown, from: object = base) {
    const copy = structuredClone(from) as Record<string, unknown>;
    let at: Record<string, unknown> = copy;
    for (const key of path.slice(0, -1)) at = at[key] as Record<string, unknown>;
    const last = path.at(-1) as string;
    if (value === undefined) delete at[last];
    else at[last] = value;
    return copy;
}

function brief(before: DesignTokens, after: DesignTokens, moved?: Move[]) {
    return after.diff(before, moved && { moved }).map((change) => {
        const shown: Record<string, unknown> = { kind: change.kind, path: change.path };
        if ("from" in change) shown.from = change.from;
        if ("properties" in change) shown.properties = change.properties;
        shown.permutations = change.permutations.inputs;
        return shown;
    });
}

describe("diff", () => {
    it("gives nothing when nothing changed", () => {
        expect(read().diff(read())).toEqual([]);
    });

    it("gives a value changed in a file every permutation reads once, in each permutation it shows in", () => {
        const after = read({ base: changed(["space", "sm"], px(5)) });
        expect(brief(read(), after)).toEqual([
            {
                kind: "changed",
                path: "space.sm",
                properties: ["value"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives a value changed in one context's file only in that context", () => {
        const after = read({ dark: changed(["space", "md"], px(12), dark) });
        expect(brief(read(), after)).toEqual([
            { kind: "changed", path: "space.md", properties: ["value"], permutations: [darkTheme] },
        ]);
    });

    it("leaves out a permutation where a later file still writes the token", () => {
        const after = read({ base: changed(["space", "md"], px(9)) });
        expect(brief(read(), after)).toEqual([
            { kind: "changed", path: "space.md", properties: ["value"], permutations: [light] },
        ]);
    });

    it("gives one change per different before and after", () => {
        const after = read({
            base: changed(["space", "md"], px(9)),
            dark: changed(["space", "md"], px(11), dark),
        });
        const changes = after.diff(read());
        expect(changes.map((change) => [change.path, change.permutations.inputs])).toEqual([
            ["space.md", [light]],
            ["space.md", [darkTheme]],
        ]);
    });

    it("gives what the file wrote for the token before and after, the same in every permutation", () => {
        const after = read({ base: changed(["space", "sm"], px(5)) });
        const [change] = after.diff(read());
        expect(change?.permutations.inputs).toStrictEqual([light, darkTheme]);
        expect(change?.kind === "changed" && [change.before, change.after]).toStrictEqual([
            { value: { value: 4, unit: "px" } },
            { value: { value: 5, unit: "px" } },
        ]);
    });

    it("gives everything the file wrote, each property as written", () => {
        const after = read({
            base: changed(["space", "sm"], { ...px(4), $description: "Small", $deprecated: true }),
        });
        const [change] = after.diff(read());
        expect(change).toMatchObject({
            properties: ["description", "deprecated"],
            after: { value: { value: 4, unit: "px" }, description: "Small", deprecated: true },
        });
    });

    it("labels the permutations a change holds in", () => {
        const after = read({ dark: changed(["space", "md"], px(12), dark) });
        const [change] = after.diff(read());
        expect(change?.permutations.label).toBe("theme: dark");
    });

    it("compares what a token says, not what it resolves to", () => {
        const after = read({ base: changed(["space", "sm"], px(5)) });
        expect(brief(read(), after).map((change) => change.path)).not.toContain("space.gap");
    });

    it("gives a reference pointed somewhere else as a change", () => {
        const after = read({ base: changed(["space", "gap"], { $value: "{space.md}" }) });
        expect(brief(read(), after)).toEqual([
            {
                kind: "changed",
                path: "space.gap",
                properties: ["value"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("names each property that changed", () => {
        const described = changed(["space", "sm"], { ...px(4), $description: "Small" });
        const after = read({ base: changed(["space", "md", "$deprecated"], true, described) });
        expect(brief(read(), after)).toEqual([
            {
                kind: "changed",
                path: "space.sm",
                properties: ["description"],
                permutations: [light, darkTheme],
            },
            {
                kind: "changed",
                path: "space.md",
                properties: ["deprecated"],
                permutations: [light],
            },
        ]);
    });

    it("gives a group deprecated as one change, not one for every token inside", () => {
        const after = read({ base: changed(["space", "$deprecated"], "Use size") });
        expect(brief(read(), after)).toEqual([
            {
                kind: "group-changed",
                path: "space",
                properties: ["deprecated"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives a type change, with the value that came with it", () => {
        const after = read({
            base: changed(["space", "sm"], { $type: "number", $value: 4 }),
        });
        expect(brief(read(), after)).toEqual([
            {
                kind: "changed",
                path: "space.sm",
                properties: ["value", "type"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives tokens added and removed, in the permutations they were added or removed in", () => {
        const after = read({
            base: changed(["space", "lg"], px(16), changed(["space", "md"], undefined)),
            dark: changed(["glow"], { $type: "dimension", ...px(2) }, dark),
        });
        expect(brief(read(), after)).toEqual([
            { kind: "added", path: "space.lg", permutations: [light, darkTheme] },
            { kind: "removed", path: "space.md", permutations: [light] },
            { kind: "added", path: "glow", permutations: [darkTheme] },
        ]);
    });

    it("gives a rename it is not told about as a removal and an addition", () => {
        const after = read({
            base: changed(["space", "small"], px(4), changed(["space", "sm"], undefined)),
        });
        expect(brief(read(), after).map((change) => [change.kind, change.path])).toContainEqual([
            "removed",
            "space.sm",
        ]);
    });

    it("gives a token moved as a rename, and the references a rename rewrote as no change", () => {
        const moved = changed(["space", "small"], px(4), changed(["space", "sm"], undefined));
        const after = read({ base: changed(["space", "gap"], { $value: "{space.small}" }, moved) });
        expect(brief(read(), after, [{ from: "space.sm", to: "space.small" }])).toEqual([
            {
                kind: "renamed",
                path: "space.small",
                from: "space.sm",
                properties: [],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives no change for a reference a rename rewrote in a value that isn't valid", () => {
        const broken = (name: string) => ({
            $value: { value: { $ref: `#/space/${name}/$value/value` }, unit: "furlong" },
        });
        const moved = changed(["space", "small"], px(4), changed(["space", "sm"], undefined));
        const renamed = changed(["space", "gap"], { $value: "{space.small}" }, moved);
        const before = read({ base: changed(["space", "odd"], broken("sm")) });
        const after = read({ base: changed(["space", "odd"], broken("small"), renamed) });
        expect(brief(before, after, [{ from: "space.sm", to: "space.small" }])).toEqual([
            {
                kind: "renamed",
                path: "space.small",
                from: "space.sm",
                properties: [],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives a group renamed, and one rename per token inside, and none for tokens pointing in", () => {
        const { typography, ...rest } = base;
        const text = { $type: "dimension", size: { $value: "{type.body}" } };
        const renamed = read({ base: { ...rest, type: typography, text } });
        const everywhere = [light, darkTheme];
        expect(brief(read(), renamed, [{ from: "typography", to: "type" }])).toEqual([
            {
                kind: "group-renamed",
                path: "type",
                from: "typography",
                properties: [],
                permutations: everywhere,
            },
            {
                kind: "renamed",
                path: "type.body",
                from: "typography.body",
                properties: [],
                permutations: everywhere,
            },
            {
                kind: "renamed",
                path: "type.heading",
                from: "typography.heading",
                properties: [],
                permutations: everywhere,
            },
        ]);
    });

    it("gives an empty group renamed", () => {
        const before = read({ base: { ...base, motion: {} } });
        const after = read({ base: { ...base, animation: {} } });
        expect(brief(before, after, [{ from: "motion", to: "animation" }])).toEqual([
            {
                kind: "group-renamed",
                path: "animation",
                from: "motion",
                properties: [],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives a token renamed and changed as a rename naming what changed", () => {
        const moved = changed(["space", "small"], px(3), changed(["space", "sm"], undefined));
        const after = read({ base: changed(["space", "gap"], { $value: "{space.small}" }, moved) });
        expect(brief(read(), after, [{ from: "space.sm", to: "space.small" }])).toEqual([
            {
                kind: "renamed",
                path: "space.small",
                from: "space.sm",
                properties: ["value"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives a token removed and another renamed into its place as a removal and a rename", () => {
        const moved = changed(["space", "md"], px(4), changed(["space", "sm"], undefined));
        const after = read({
            base: changed(["space", "gap"], { $value: "{space.md}" }, moved),
            dark: {},
        });
        const before = read({ dark: {} });
        expect(brief(before, after, [{ from: "space.sm", to: "space.md" }])).toEqual([
            {
                kind: "renamed",
                path: "space.md",
                from: "space.sm",
                properties: [],
                permutations: [light, darkTheme],
            },
            { kind: "removed", path: "space.md", permutations: [light, darkTheme] },
        ]);
    });

    it("follows moves made one after another", () => {
        const moved = changed(["space", "tiny"], px(4), changed(["space", "sm"], undefined));
        const after = read({ base: changed(["space", "gap"], { $value: "{space.tiny}" }, moved) });
        const moves = [
            { from: "space.sm", to: "space.small" },
            { from: "space.small", to: "space.tiny" },
        ];
        expect(brief(read(), after, moves)).toEqual([
            {
                kind: "renamed",
                path: "space.tiny",
                from: "space.sm",
                properties: [],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("follows a move through a JSON Pointer reference", () => {
        const pointing = changed(["space", "gap"], { $value: { $ref: "#/space/sm/$value" } });
        const moved = changed(
            ["space", "small"],
            px(4),
            changed(["space", "sm"], undefined, pointing),
        );
        const after = read({
            base: changed(["space", "gap"], { $value: { $ref: "#/space/small/$value" } }, moved),
        });
        const changes = brief(read({ base: pointing }), after, [
            { from: "space.sm", to: "space.small" },
        ]);
        expect(changes.map((change) => change.path)).toEqual(["space.small"]);
    });

    it("gives groups added, removed and changed, an empty group included", () => {
        const { typography: _, ...rest } = base;
        const after = read({
            base: changed(["space", "$description"], "Gaps between things", {
                ...rest,
                motion: {},
            }),
        });
        expect(brief(read(), after)).toEqual([
            {
                kind: "group-changed",
                path: "space",
                properties: ["description"],
                permutations: [light, darkTheme],
            },
            { kind: "group-added", path: "motion", permutations: [light, darkTheme] },
            { kind: "group-removed", path: "typography", permutations: [light, darkTheme] },
            { kind: "removed", path: "typography.body", permutations: [light, darkTheme] },
            { kind: "removed", path: "typography.heading", permutations: [light, darkTheme] },
        ]);
    });

    it("gives a group renamed with a new description as a rename naming what changed", () => {
        const { typography, ...rest } = base;
        const text = { $type: "dimension", size: { $value: "{type.body}" } };
        const after = read({
            base: { ...rest, type: { ...typography, $description: "Sizes" }, text },
        });
        expect(brief(read(), after, [{ from: "typography", to: "type" }])[0]).toEqual({
            kind: "group-renamed",
            path: "type",
            from: "typography",
            properties: ["description"],
            permutations: [light, darkTheme],
        });
    });

    it("gives a group starting to extend another, and the tokens it takes, marked as inherited", () => {
        const button = (primary: object) => ({
            button: { $type: "dimension", base: { pad: px(4) }, primary },
        });
        const changes = read({ base: button({ $extends: "{button.base}" }) }).diff(
            read({ base: button({}) }),
        );
        expect(changes.map((change) => [change.kind, change.path])).toEqual([
            ["group-changed", "button.primary"],
            ["added", "button.primary.pad"],
        ]);
        expect(changes[0]).toMatchObject({
            properties: ["extends"],
            after: { extends: "button.base" },
        });
        expect(changes[1]).toMatchObject({ inherited: { from: "button.base" } });
    });

    it("gives a group's $extends changing as written, though it reaches no group", () => {
        const version = (extended: string) =>
            readFromMemory({
                files: {
                    "tokens.json": JSON.stringify({
                        card: { $extends: `{${extended}}`, gap: { $type: "number", $value: 1 } },
                    }),
                },
            });
        const changes = version("elsewhere").diff(version("nowhere"));
        expect(changes).toMatchObject([
            {
                kind: "group-changed",
                path: "card",
                properties: ["extends"],
                before: { extends: "nowhere" },
                after: { extends: "elsewhere" },
            },
        ]);
    });

    it("leaves out a group whose setting changed only in the group it extends", () => {
        const version = (description: string) =>
            readFromMemory({
                files: {
                    "tokens.json": JSON.stringify({
                        button: { $type: "number", $description: description, pad: { $value: 1 } },
                        primary: { $extends: "{button}" },
                    }),
                },
            });
        const changes = version("Base button").diff(version("Base"));
        expect(changes.map((change) => [change.kind, change.path])).toEqual([
            ["group-changed", "button"],
        ]);
    });

    it("gives the top of a file changing what it writes", () => {
        const version = (description: string) =>
            readFromMemory({
                files: {
                    "tokens.json": JSON.stringify({
                        $description: description,
                        a: { $type: "number", $value: 1 },
                    }),
                },
            });
        expect(version("Two").diff(version("One"))).toMatchObject([
            { kind: "top-level-changed", properties: ["description"] },
        ]);
    });

    it("gives a group's own type changing, and a token now writing the type itself", () => {
        const after = read({
            base: changed(["text"], { size: { $type: "dimension", $value: "{typography.body}" } }),
        });
        expect(brief(read(), after)).toEqual([
            {
                kind: "group-changed",
                path: "text",
                properties: ["type"],
                permutations: [light, darkTheme],
            },
            {
                kind: "changed",
                path: "text.size",
                properties: ["type"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("leaves out a permutation only one read has", () => {
        const more = JSON.parse(resolver);
        more.modifiers.theme.contexts.dim = [];
        const after = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify(more),
                "base.json": JSON.stringify(changed(["space", "sm"], px(5))),
                "dark.json": JSON.stringify(dark),
            },
        });
        expect(brief(read(), after)).toEqual([
            {
                kind: "changed",
                path: "space.sm",
                properties: ["value"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("gives the tokens a generator made, marked as generated, and the extension's change on its group", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: (_group, extension) => ({
                ok: true,
                value: [{ name: "1", $value: extension as number }],
            }),
        });
        const scale = (step: number) =>
            readFromMemory(
                {
                    files: {
                        "tokens.json": JSON.stringify({
                            space: {
                                $type: "number",
                                $extensions: { "com.example": { steps: step } },
                            },
                        }),
                    },
                },
                { generators: [steps] },
            );
        const changes = scale(2).diff(scale(1));
        expect(changes.map((change) => [change.kind, change.path])).toEqual([
            ["group-changed", "space"],
            ["changed", "space.1"],
        ]);
        expect(changes[1]).toMatchObject({ properties: ["value"], generated: { from: "space" } });
        expect(
            changes[1]?.kind === "changed" && [changes[1].before, changes[1].after],
        ).toStrictEqual([{}, {}]);
    });

    it("compares a color's hex fallback inside $extensions, where it is not a value", () => {
        const swatch = (hex: string) => ({
            ...px(4),
            $extensions: { "com.example": { colorSpace: "srgb", hex } },
        });
        const before = read({ base: changed(["space", "sm"], swatch("#000000")) });
        const after = read({ base: changed(["space", "sm"], swatch("#ffffff")) });
        expect(brief(before, after)).toEqual([
            {
                kind: "changed",
                path: "space.sm",
                properties: ["extensions"],
                permutations: [light, darkTheme],
            },
        ]);
    });

    it("follows a move through what a group extends", () => {
        const button = (name: string) => ({
            button: {
                $type: "dimension",
                [name]: { pad: px(4) },
                primary: { $extends: `{button.${name}}` },
            },
        });
        const changes = brief(read({ base: button("base") }), read({ base: button("core") }), [
            { from: "button.base", to: "button.core" },
        ]);
        expect(changes.map((change) => change.kind)).toEqual(["group-renamed", "renamed"]);
    });

    it("gives an invalid value edited as a change", () => {
        const broken = read({ base: changed(["space", "sm"], { $value: "wide" }) });
        const after = read({ base: changed(["space", "sm"], { $value: "wider" }) });
        expect(brief(broken, after).map((change) => change.path)).toEqual(["space.sm"]);
    });

    it("compares values allowing for rounding", () => {
        const before = read();
        const after = read({ base: changed(["space", "sm"], px(4.0001)) });
        expect(after.diff(before)).toEqual([]);
    });
});

const srgb = (r: number, g: number, b: number, extra: Partial<ColorValue> = {}): ColorValue => ({
    colorSpace: "srgb",
    components: [r, g, b],
    alpha: 1,
    ...extra,
});

describe("isEquivalentValue", () => {
    it("treats a hex fallback and components written to three places as the same color", () => {
        const fromHex = srgb(0.2196, 0.5176, 0.949, { hex: "#3884f2" });
        expect(isEquivalentValue("color", fromHex, srgb(0.22, 0.518, 0.949))).toBe(true);
        expect(isEquivalentValue("color", srgb(0.22, 0.518, 0.949), fromHex)).toBe(true);
    });

    it("tells colors apart beyond that rounding", () => {
        expect(isEquivalentValue("color", srgb(0.22, 0.518, 0.949), srgb(0.221, 0.518, 0.949))).toBe(false);
        expect(isEquivalentValue("color", srgb(0.2, 0.5, 0.9), srgb(0.2, 0.5, 0.9, { alpha: 0.5 }))).toBe(
            false,
        );
    });

    it("tells colors in different color spaces apart", () => {
        const p3: ColorValue = { colorSpace: "display-p3", components: [0.2, 0.5, 0.9], alpha: 1 };
        expect(isEquivalentValue("color", srgb(0.2, 0.5, 0.9), p3)).toBe(false);
    });

    it("treats `none` as equal only to `none`", () => {
        const none: ColorValue = { colorSpace: "oklch", components: [0.5, 0, "none"], alpha: 1 };
        const zero: ColorValue = { colorSpace: "oklch", components: [0.5, 0, 0], alpha: 1 };
        expect(isEquivalentValue("color", none, structuredClone(none))).toBe(true);
        expect(isEquivalentValue("color", none, zero)).toBe(false);
    });

    it("tells lengths in different units apart", () => {
        expect(isEquivalentValue("dimension", { value: 16, unit: "px" }, { value: 1, unit: "rem" })).toBe(
            false,
        );
        expect(
            isEquivalentValue("dimension", { value: 0.1 + 0.2, unit: "rem" }, { value: 0.3, unit: "rem" }),
        ).toBe(true);
    });

    it("compares composite values part by part", () => {
        const layer = {
            color: srgb(0, 0, 0, { alpha: 0.2 }),
            offsetX: { value: 0, unit: "px" as const },
            offsetY: { value: 1, unit: "px" as const },
            blur: { value: 2, unit: "px" as const },
            spread: { value: 0, unit: "px" as const },
            inset: false,
        };
        expect(isEquivalentValue("shadow", [layer], [structuredClone(layer)])).toBe(true);
        expect(isEquivalentValue("shadow", [layer], [{ ...layer, inset: true }])).toBe(false);
        expect(isEquivalentValue("shadow", [layer], [layer, layer])).toBe(false);
    });

    it("compares references as references", () => {
        expect(
            isEquivalentValue(
                "dimension",
                { syntax: "curly-brace", path: "space.sm" },
                { syntax: "curly-brace", path: "space.sm" },
            ),
        ).toBe(true);
        expect(
            isEquivalentValue(
                "dimension",
                { syntax: "curly-brace", path: "space.sm" },
                { syntax: "curly-brace", path: "space.md" },
            ),
        ).toBe(false);
        expect(
            isEquivalentValue(
                "dimension",
                { syntax: "curly-brace", path: "space.sm" },
                { value: 4, unit: "px" },
            ),
        ).toBe(false);
        expect(
            isEquivalentValue(
                "dimension",
                { syntax: "json-pointer", pointer: "#/space/sm/$value" },
                { syntax: "json-pointer", pointer: "#/space/sm/$value" },
            ),
        ).toBe(true);
    });

    it("compares two tokens by type and by the value they say, not where it leads", () => {
        const tokens = read();
        const sm = tokens.permutation().token("space.sm");
        const gap = tokens.permutation().token("space.gap");
        const body = tokens.permutation().token("typography.body");
        if (!sm || !gap || !body) throw new Error("missing token");
        expect(isEquivalentValue(sm, structuredClone(sm))).toBe(true);
        expect(isEquivalentValue(sm, gap)).toBe(false);
        expect(isEquivalentValue(sm, body)).toBe(false);
        expect(isEquivalentValue(sm, { ...sm, type: "number" } as typeof sm)).toBe(false);
    });
});
