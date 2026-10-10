import { describe, expect, it } from "vitest";
import { type Analysis, impact, tokenAt, unused } from "../src/analyze/answers.js";
import { systemOf } from "../src/analyze/system.js";
import type { Use } from "../src/analyze/uses.js";
import { buildFiles } from "../src/build.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const black = { colorSpace: "srgb", components: [0, 0, 0] };

const resolver = {
    version: "2025.10",
    sets: {
        palette: {
            sources: [{ $ref: "palette.json" }],
            $extensions: { "sh.sugarcube": { emit: false } },
        },
        base: { sources: [{ $ref: "base.json" }] },
    },
    resolutionOrder: [
        { $ref: "#/sets/palette" },
        { $ref: "#/sets/base" },
        {
            type: "modifier",
            name: "theme",
            default: "light",
            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
        },
    ],
};

const themed = {
    "tokens.resolver.json": resolver,
    "palette.json": { hidden: { via: color("{color.target}"), lonely: color(black) } },
    "base.json": {
        color: {
            "target": color(black),
            "through-private": color("{hidden.via}"),
            "pointed": color(black),
            "pointer": color({ $ref: "#/color/pointed/$value" }),
            "surface": color("{color.target}"),
            "night": color(black),
            "orphan": color(black),
            "on-surface": color("{color.surface}"),
        },
        group: { $root: color("{color.target}") },
        route: { a: color("{color.target}"), b: color("{color.target}") },
        switch: color("{route.a}"),
    },
    "dark.json": { color: { surface: color("{color.night}") }, switch: color("{route.b}") },
};

const use = (token: string, file = "/project/app.css", line = 1): Use => ({
    token,
    file,
    line,
    var: `--${token.replaceAll(".", "-")}`,
});

async function analysisOf(...uses: Use[]): Promise<Analysis> {
    const texts = Object.fromEntries(
        Object.entries(themed).map(([name, json]) => [name, JSON.stringify(json)]),
    );
    const system = systemOf(await buildFiles(texts, "/project"));
    return {
        system,
        uses: {
            uses,
            scanned: { forVarReferences: ["/project/app.css"], forUtilityClasses: [] },
            unread: [],
        },
    };
}

function impactOf(analysis: Analysis, path: string) {
    const found = tokenAt(analysis.system, path);
    if (!found || found === "group") throw new Error(`no token ${path}`);
    return impact(analysis, found);
}

describe("unused", () => {
    it("lists private tokens too, as tokens of the system, and counts them", async () => {
        const answer = unused(await analysisOf());

        expect(answer.unused).toContain("hidden.lonely");
        expect(answer.total).toBe(14);
    });

    it("follows a chain of references through a private token", async () => {
        const { unused: left } = unused(await analysisOf(use("color.through-private")));

        expect(left).not.toContain("hidden.via");
        expect(left).not.toContain("color.target");
    });

    it("counts a pointer as using the token it points into", async () => {
        expect(unused(await analysisOf(use("color.pointer"))).unused).not.toContain(
            "color.pointed",
        );
    });

    it("counts what any permutation it writes reaches", async () => {
        const { unused: left } = unused(await analysisOf(use("color.surface")));

        expect(left).not.toContain("color.target");
        expect(left).not.toContain("color.night");
        expect(left).toContain("color.orphan");
    });

    it("lists them in sorted order", async () => {
        const { unused: left } = unused(await analysisOf());

        expect(left).toStrictEqual([...left].sort());
    });
});

describe("impact", () => {
    it("gives the token, what reaches it and what each refers to on the way", async () => {
        const answer = impactOf(await analysisOf(), "color.target");

        expect(answer.token.path).toBe("color.target");
        expect(answer.dependents).toStrictEqual([
            { path: "color.on-surface", references: ["color.surface"], inDefault: "color.surface" },
            { path: "color.surface", references: ["color.target"], inDefault: "color.target" },
            { path: "color.through-private", references: ["hidden.via"], inDefault: "hidden.via" },
            { path: "group.$root", references: ["color.target"], inDefault: "color.target" },
            { path: "hidden.via", references: ["color.target"], inDefault: "color.target" },
            { path: "route.a", references: ["color.target"], inDefault: "color.target" },
            { path: "route.b", references: ["color.target"], inDefault: "color.target" },
            {
                path: "switch",
                references: ["route.a", "route.b"],
                inDefault: "route.a",
                label: "per theme",
            },
        ]);
    });

    it("keeps only the uses of the token and what reaches it", async () => {
        const answer = impactOf(
            await analysisOf(
                use("color.surface"),
                use("color.orphan"),
                use("color.target", "/project/b.css", 4),
            ),
            "color.target",
        );

        expect(answer.uses.map(({ token }) => token)).toStrictEqual([
            "color.surface",
            "color.target",
        ]);
    });

    it("names the default permutation's reference only where it holds there", async () => {
        const answer = impactOf(await analysisOf(), "color.night");

        expect(answer.dependents).toContainEqual({
            path: "color.on-surface",
            references: ["color.surface"],
        });
        expect(answer.dependents).toContainEqual({
            path: "color.surface",
            references: ["color.night"],
        });
    });
});

describe("tokenAt", () => {
    it("says when a path is a group, not a token", async () => {
        expect(tokenAt((await analysisOf()).system, "color")).toBe("group");
    });

    it("says when a path is nothing", async () => {
        expect(tokenAt((await analysisOf()).system, "nowhere")).toBeUndefined();
    });
});
