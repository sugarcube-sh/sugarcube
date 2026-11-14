import { describe, expect, it } from "vitest";
import {
    canAddGroup,
    canAddToken,
    createGroupEdit,
    toNewToken,
    createTokenEdit,
    createRemoval,
    createRenameEdit,
} from "../../src/controllers/actions";
import { getGroupPageView } from "../../src/controllers/views";
import { getTokenPageView } from "../../src/controllers/token-page";
import { demoMessage, createDemoStudio } from "./demo-message";

const studio = () =>
    createDemoStudio(
        demoMessage({
            entryFile: "tokens.json",
            files: {
                "tokens.json": JSON.stringify({
                    space: { $type: "number", s: { $value: 4 }, m: { $value: 8 } },
                    gap: { $type: "number", $value: "{space.s}" },
                    button: {
                        $type: "number",
                        pad: { $value: "{space.m}" },
                        icon: { size: { $value: 1 } },
                    },
                    primary: { $extends: "{button}" },
                }),
            },
        }),
    );

describe("renaming", () => {
    it("renames a token or a group", () => {
        const { state } = studio();

        expect(createRenameEdit(state.tokens, "space", "size").result).toMatchObject({
            moves: [{ from: "space", to: "size" }],
        });
        expect(createRenameEdit(state.tokens, "space.s", "sm").result).toMatchObject({
            moves: [{ from: "space.s", to: "space.sm" }],
        });
    });
});

describe("removing", () => {
    it("removes straight away when nothing outside refers into it", () => {
        const { state } = studio();

        expect(createRemoval(state.tokens, "gap")).toMatchObject({ kind: "immediate" });
        expect(createRemoval(state.tokens, "gap").edit.result.ops).toHaveLength(1);
    });

    it("lists what would break when something outside refers into it", () => {
        const { state } = studio();

        expect(createRemoval(state.tokens, "space")).toMatchObject({
            kind: "confirm",
            pathsWithBrokenReferences: ["gap", "button.pad", "primary.pad"],
        });
        expect(createRemoval(state.tokens, "space.s")).toMatchObject({
            kind: "confirm",
            pathsWithBrokenReferences: ["gap"],
        });
        expect(createRemoval(state.tokens, "button")).toMatchObject({
            kind: "confirm",
            pathsWithBrokenReferences: ["primary"],
        });
    });
});

describe("adding", () => {
    it("makes an empty group inside the group, and says where", () => {
        const { state } = studio();
        const made = createGroupEdit(state.tokens, "space", "large");

        expect(made.path).toBe("space.large");
        expect(made.result.ops).toEqual([
            expect.objectContaining({ kind: "add", jsonPath: ["space", "large"], value: {} }),
        ]);
    });

    it("makes a token inside the group, leaving out a type the group gives", () => {
        const { state } = studio();
        const space = state.shownPermutation.getGroup("space")!;

        expect(
            createTokenEdit(state.tokens, space, "l", { type: "number", value: 16 }).result.ops,
        ).toEqual([
            expect.objectContaining({
                kind: "add",
                jsonPath: ["space", "l"],
                value: { $value: 16 },
            }),
        ]);
    });

    it("can add once there is a name, and for a token a whole value", () => {
        expect(canAddGroup("")).toBe(false);
        expect(canAddGroup("large")).toBe(true);
        expect(canAddToken("", 16)).toBe(false);
        expect(canAddToken("l", undefined)).toBe(false);
        expect(canAddToken("l", 16)).toBe(true);
    });
});

describe("which pages offer the actions", () => {
    it("offers them on a group, except one only there through $extends", () => {
        const { state } = studio();

        expect(getGroupPageView(state, state.shownPermutation.getGroup("space")!).editable).toBe(
            true,
        );
        expect(getGroupPageView(state, state.shownPermutation.getGroup("primary")!).editable).toBe(
            true,
        );
        expect(
            getGroupPageView(state, state.shownPermutation.getGroup("primary.icon")!).editable,
        ).toBe(false);
    });

    it("offers them on a token, except one only there through $extends", () => {
        const { state } = studio();

        expect(
            getTokenPageView(state, state.shownPermutation.getToken("space.s")!, []).editable,
        ).toBe(true);
        expect(
            getTokenPageView(state, state.shownPermutation.getToken("primary.icon.size")!, [])
                .editable,
        ).toBe(false);
    });
});

describe("a value row's name", () => {
    it("is its label, or says it is an override not yet written", () => {
        const { state } = createDemoStudio();
        const token = state.shownPermutation.getToken("color.brand.500")!;
        const [base] = getTokenPageView(state, token, []).rows;
        const adding = getTokenPageView(state, token, ["mode: dark"]).rows.find((row) => row.isNew);

        expect([base?.name, base?.fieldLabel]).toEqual(["base", "base"]);
        expect([adding?.name, adding?.fieldLabel]).toEqual([
            "Override for mode: dark",
            "Override for mode: dark",
        ]);
    });

    it("names its field after the token where the row has no label", () => {
        const { state } = studio();
        const [row] = getTokenPageView(state, state.shownPermutation.getToken("space.s")!, []).rows;

        expect([row?.name, row?.fieldLabel]).toEqual([undefined, "space.s"]);
    });
});

describe("toNewToken", () => {
    it("leaves the type out when it is the group's, so the token takes it from the group", () => {
        const group = createDemoStudio().state.tokens.getPermutation().getGroup("color.text");

        expect(toNewToken({ type: "color", value: "{color.brand.500}" }, group)).toEqual({
            $value: "{color.brand.500}",
        });
    });

    it("writes the type when it isn't the group's", () => {
        const group = createDemoStudio().state.tokens.getPermutation().getGroup("color.text");

        expect(toNewToken({ type: "dimension", value: { value: 1, unit: "rem" } }, group)).toEqual({
            $type: "dimension",
            $value: { value: 1, unit: "rem" },
        });
    });

    it("writes the type for a token made at the top, with no group", () => {
        expect(toNewToken({ type: "number", value: 1 }, undefined)).toEqual({
            $type: "number",
            $value: 1,
        });
    });
});
