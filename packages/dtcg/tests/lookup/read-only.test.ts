import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";

const tokens = readFromMemory({
    files: {
        "tokens.json": JSON.stringify({
            color: {
                $type: "color",
                red: { $value: { colorSpace: "srgb", components: [1, 0, 0] } },
                brand: { $value: "{color.red}" },
                broken: { $value: "{color.missing}" },
            },
        }),
    },
});
const permutation = tokens.getPermutation();
const group = permutation.getGroup("color")!;
const brand = permutation.getToken("color.brand")!;
const red = permutation.getToken("color.red")!;
const [source] = tokens.sources;

function changesWhatTheReadGave(): void {
    // @ts-expect-error the read's lists are shared, so they can't be changed in place
    permutation.tokens.sort();
    // @ts-expect-error
    permutation.groups.push(permutation.groups[0]!);
    // @ts-expect-error
    permutation.children.reverse();
    // @ts-expect-error
    group.children.splice(0, 1);
    // @ts-expect-error
    group.childTokens.sort();
    // @ts-expect-error
    group.tokens.pop();
    // @ts-expect-error
    brand.definitions.push(brand.definitions[0]!);
    // @ts-expect-error
    brand.references.length = 0;
    // @ts-expect-error
    tokens.diagnostics.sort();
    // @ts-expect-error
    tokens.files.push("more.json");
    // @ts-expect-error
    tokens.resolver?.modifiers.pop();
    // @ts-expect-error
    tokens.permutations.scope.pop();
    // @ts-expect-error
    tokens.resolver?.resolutionOrder.pop();
    // @ts-expect-error
    if (source!.readBy !== "every-context") source!.readBy.pop();
    // @ts-expect-error
    brand.references[0]!.writtenInProperty!.push("color");
    // @ts-expect-error nor can anything inside them be assigned
    brand.path = "color.other";
    // @ts-expect-error
    brand.definitions[0]!.span.offset = 0;
    // @ts-expect-error
    brand.extensions!["com.example"] = {};
    if (red.type === "color" && red.resolved) {
        // @ts-expect-error
        red.resolved.alpha = 0.5;
        // @ts-expect-error
        red.resolved.components[0] = 0;
    }
    for (const found of tokens.diagnostics) {
        // @ts-expect-error
        found.message = "";
        // @ts-expect-error
        if (found.kind === "missing-reference") found.detail.from.push("color.other");
    }
    // @ts-expect-error an answer is part of what the read gives, so it can't be changed either
    tokens.getDependents("color.red").sort();
    // @ts-expect-error
    tokens.getReferencesTo("color.red").pop();
    // @ts-expect-error
    tokens.getTokenPaths().reverse();
    // @ts-expect-error
    tokens.getChangesSince(tokens)[0]!.path = "color.other";
}

describe("the design tokens a read gives", () => {
    it("are read-only, answers included, while a copy can be changed", () => {
        expect(changesWhatTheReadGave).toBeTypeOf("function");
        const sorted = [...permutation.tokens].sort((a, b) => a.path.localeCompare(b.path));
        const users = [...tokens.getDependents("color.red")].sort((a, b) =>
            a.path.localeCompare(b.path),
        );

        expect(sorted.map(({ path }) => path)).toStrictEqual([
            "color.brand",
            "color.broken",
            "color.red",
        ]);
        expect(users.map(({ path }) => path)).toStrictEqual(["color.brand"]);
    });
});
