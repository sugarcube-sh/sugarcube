import { remove, rename, setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { clashRows } from "../../src/controllers/token-page";
import { demoMessage, studioOn, withFile } from "./demo-message";

const darkText = { input: { mode: "dark" } } as const;

function changedOnDisk() {
    const dark = demoMessage().files["dark.json"] ?? "";
    return withFile("dark.json", dark.replace("{color.neutral.50}", "{color.neutral.200}"));
}

describe("clashes", () => {
    it("come from a change on disk to a value you edited", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );

        studio.receive(changedOnDisk());

        expect(
            studio.state.clashes
                .flatMap((clash) => clash.parts)
                .map(({ path, yours, theirs }) => [path, yours, theirs]),
        ).toEqual([
            [
                "color.text.default",
                { $value: "{color.neutral.100}" },
                { $value: "{color.neutral.200}" },
            ],
        ]);
    });

    it("are none from a change on disk to a value you didn't edit", () => {
        const studio = studioOn();
        studio.do(setValue(studio.state.tokens, "radius.md", { value: 0.5, unit: "rem" }));

        studio.receive(changedOnDisk());

        expect(studio.state.clashes).toEqual([]);
        expect(studio.state.changes.map(({ path }) => path)).toEqual(["radius.md"]);
    });

    it("go once the edits are discarded", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
        studio.receive(changedOnDisk());

        studio.discard();

        expect(studio.state.clashes).toEqual([]);
    });

    it("keep yours: writes yours over theirs as an edit, and the clash goes", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
        studio.receive(changedOnDisk());
        const [clash] = studio.state.clashes;

        studio.keep(clash!, "yours");

        expect(studio.state.clashes).toEqual([]);
        expect(
            studio.state.tokens.getPermutation({ mode: "dark" }).getToken("color.text.default")
                ?.value,
        ).toEqual({ syntax: "curly-brace", path: "color.neutral.100" });
        expect(studio.state.changes.map(({ path }) => path)).toEqual(["color.text.default"]);
    });

    it("keep theirs: changes nothing, and the clash goes", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
        studio.receive(changedOnDisk());
        const [clash] = studio.state.clashes;

        studio.keep(clash!, "theirs");

        expect(studio.state.clashes).toEqual([]);
        expect(
            studio.state.tokens.getPermutation({ mode: "dark" }).getToken("color.text.default")
                ?.value,
        ).toEqual({ syntax: "curly-brace", path: "color.neutral.200" });
        expect(studio.state.changes).toEqual([]);
    });
});

describe("clashRows", () => {
    it("a value you both changed: the token, its theme, and both values", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
        studio.receive(changedOnDisk());

        expect(clashRows(studio.state.tokens, studio.state.clashes)).toEqual([
            {
                clash: studio.state.clashes[0],
                kind: "changed",
                path: "color.text.default",
                label: "mode: dark",
                yours: "{color.neutral.100}",
                theirs: "{color.neutral.200}",
                canKeepYours: true,
            },
        ]);
    });

    it("a rename that no longer fits: one row, what you renamed it to, and not keepable", () => {
        const studio = studioOn();
        studio.do(rename(studio.state.tokens, "color.text.default", "defaultttttt"));
        const color = demoMessage().files["color.json"] ?? "";
        studio.receive(withFile("color.json", color.replace('"default": {', '"body": {')));

        expect(studio.state.tokens.has("color.text.defaultttttt")).toBe(false);
        expect(clashRows(studio.state.tokens, studio.state.clashes)).toEqual([
            {
                clash: studio.state.clashes[0],
                kind: "renamed",
                from: "color.text.default",
                to: "color.text.defaultttttt",
                canKeepYours: false,
            },
        ]);
    });

    it("a value you changed that was removed or renamed elsewhere: yours, and not keepable", () => {
        const studio = studioOn();
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkText),
        );
        const dark = demoMessage().files["dark.json"] ?? "";
        studio.receive(
            withFile(
                "dark.json",
                dark.replace('"default": { "$value": "{color.neutral.50}" },', ""),
            ),
        );

        expect(clashRows(studio.state.tokens, studio.state.clashes)).toMatchObject([
            {
                kind: "gone",
                path: "color.text.default",
                yours: "{color.neutral.100}",
                canKeepYours: false,
            },
        ]);
    });

    it("a token you removed that was changed elsewhere: theirs, and keepable", () => {
        const studio = studioOn();
        studio.do(remove(studio.state.tokens, "radius.full"));
        const radius = demoMessage().files["radius.json"] ?? "";
        studio.receive(
            withFile(
                "radius.json",
                radius.replace('"value": 100, "unit": "rem"', '"value": 1000, "unit": "px"'),
            ),
        );

        expect(clashRows(studio.state.tokens, studio.state.clashes)).toMatchObject([
            {
                kind: "removed",
                path: "radius.full",
                theirs: { value: 1000, unit: "px" },
                canKeepYours: true,
            },
        ]);
    });
});

describe("a step with several parts", () => {
    it("reads as removed or renamed elsewhere when any part is gone, not just the first", () => {
        const studio = studioOn();
        studio.do(remove(studio.state.tokens, "color.text.default"));
        const color = demoMessage().files["color.json"] ?? "";
        const dark = demoMessage().files["dark.json"] ?? "";
        studio.receive(
            withFile(
                "dark.json",
                dark.replace('"default": { "$value": "{color.neutral.50}" },', ""),
                withFile(
                    "color.json",
                    color.replace(
                        '"default": { "$value": "{color.neutral.900}" }',
                        '"default": { "$value": "{color.neutral.800}" }',
                    ),
                ),
            ),
        );

        const [row] = clashRows(studio.state.tokens, studio.state.clashes);

        expect(row?.canKeepYours).toBe(false);
        expect(row?.kind).toBe("gone");
    });
});

describe("keeping yours where it can't be kept", () => {
    it("is refused, and the clash stays", () => {
        const studio = studioOn();
        studio.do(rename(studio.state.tokens, "color.text.default", "defaultttttt"));
        const color = demoMessage().files["color.json"] ?? "";
        studio.receive(withFile("color.json", color.replace('"default": {', '"body": {')));
        const [clash] = studio.state.clashes;

        const done = studio.keep(clash!, "yours");

        expect(done?.refusal?.kind).toBe("removed-since");
        expect(studio.state.clashes).toHaveLength(1);
    });
});
