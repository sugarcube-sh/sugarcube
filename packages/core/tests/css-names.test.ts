import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { cssNames } from "../src/shared/css/names.js";

const doc = readFromMemory({
    files: {
        "tokens.json": JSON.stringify({
            color: {
                "$type": "number",
                "brand": { $value: 1 },
                "accent": { $root: { $value: 2 }, soft: { $value: 3 } },
                "on surface": { $value: 4 },
            },
        }),
    },
});

function names(variables?: Parameters<typeof fillDefaults>[0]["variables"]) {
    return Object.fromEntries(cssNames(doc, fillDefaults({ ...(variables && { variables }) })));
}

describe("cssNames", () => {
    it("names every token from its path, with $root standing for its group", () => {
        expect(names()).toStrictEqual({
            "color.brand": "color-brand",
            "color.accent.$root": "color-accent",
            "color.accent.soft": "color-accent-soft",
            "color.on surface": "color-on-surface",
        });
    });

    it("puts the config's prefix first", () => {
        expect(names({ prefix: "ds" })["color.brand"]).toBe("ds-color-brand");
    });

    it("uses the config's variableName instead, given the path without $root", () => {
        const named = names({ variableName: (path) => path.replaceAll(".", "_") });
        expect(named["color.accent.$root"]).toBe("color_accent");
    });
});
