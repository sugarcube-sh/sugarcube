import { describe, expect, it } from "vitest";
import {
    canAddGroup,
    canAddToken,
    nameOf,
    newGroupEdit,
    newToken,
    newTokenEdit,
    removal,
    renameEdit,
} from "../../src/controllers/actions";
import { groupPage } from "../../src/controllers/views";
import { tokenPage } from "../../src/controllers/token-page";
import { demoMessage, studioOn } from "./demo-message";

const studio = () =>
    studioOn(
        demoMessage({
            entry: "tokens.json",
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
    it("starts from the current name", () => {
        expect(nameOf("space.s")).toBe("s");
        expect(nameOf("space")).toBe("space");
    });

    it("renames a token or a group", () => {
        const { state } = studio();

        expect(renameEdit(state.tokens, "space", "size").result).toMatchObject({
            moved: [{ from: "space", to: "size" }],
        });
        expect(renameEdit(state.tokens, "space.s", "sm").result).toMatchObject({
            moved: [{ from: "space.s", to: "space.sm" }],
        });
    });
});

describe("removing", () => {
    it("removes straight away when nothing outside refers into it", () => {
        const { state } = studio();

        expect(removal(state.tokens, "gap")).toMatchObject({ kind: "now" });
        expect(removal(state.tokens, "gap").edit.result.ops).toHaveLength(1);
    });

    it("lists what would break when something outside refers into it", () => {
        const { state } = studio();

        expect(removal(state.tokens, "space")).toMatchObject({
            kind: "asks",
            breaks: ["gap", "button.pad", "primary.pad"],
        });
        expect(removal(state.tokens, "space.s")).toMatchObject({ kind: "asks", breaks: ["gap"] });
        expect(removal(state.tokens, "button")).toMatchObject({
            kind: "asks",
            breaks: ["primary"],
        });
    });
});

describe("adding", () => {
    it("makes an empty group inside the group, and says where", () => {
        const { state } = studio();
        const made = newGroupEdit(state.tokens, "space", "large");

        expect(made.path).toBe("space.large");
        expect(made.result.ops).toEqual([
            expect.objectContaining({ kind: "add", jsonPath: ["space", "large"], value: {} }),
        ]);
    });

    it("makes a token inside the group, leaving out a type the group gives", () => {
        const { state } = studio();
        const space = state.showing.group("space")!;

        expect(
            newTokenEdit(state.tokens, space, "l", { type: "number", value: 16 }).result.ops,
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

        expect(groupPage(state, state.showing.group("space")!).actions).toBe(true);
        expect(groupPage(state, state.showing.group("primary")!).actions).toBe(true);
        expect(groupPage(state, state.showing.group("primary.icon")!).actions).toBe(false);
    });

    it("offers them on a token, except one only there through $extends", () => {
        const { state } = studio();

        expect(tokenPage(state, state.showing.token("space.s")!, []).actions).toBe(true);
        expect(tokenPage(state, state.showing.token("primary.icon.size")!, []).actions).toBe(false);
    });
});

describe("a value row's name", () => {
    it("is its label, or says it is an override not yet written", () => {
        const { state } = studioOn();
        const token = state.showing.token("color.brand.500")!;
        const [base] = tokenPage(state, token, []).rows;
        const adding = tokenPage(state, token, ["mode: dark"]).rows.find((row) => row.unwritten);

        expect([base?.name, base?.fieldLabel]).toEqual(["base", "base"]);
        expect([adding?.name, adding?.fieldLabel]).toEqual([
            "Override for mode: dark",
            "Override for mode: dark",
        ]);
    });

    it("names its field after the token where the row has no label", () => {
        const { state } = studio();
        const [row] = tokenPage(state, state.showing.token("space.s")!, []).rows;

        expect([row?.name, row?.fieldLabel]).toEqual([undefined, "space.s"]);
    });
});

describe("newToken", () => {
    it("leaves the type out when it is the group's, so the token takes it from the group", () => {
        const group = studioOn().state.tokens.permutation().group("color.text");

        expect(newToken({ type: "color", value: "{color.brand.500}" }, group)).toEqual({
            $value: "{color.brand.500}",
        });
    });

    it("writes the type when it isn't the group's", () => {
        const group = studioOn().state.tokens.permutation().group("color.text");

        expect(newToken({ type: "dimension", value: { value: 1, unit: "rem" } }, group)).toEqual({
            $type: "dimension",
            $value: { value: 1, unit: "rem" },
        });
    });

    it("writes the type for a token made at the top, with no group", () => {
        expect(newToken({ type: "number", value: 1 }, undefined)).toEqual({
            $type: "number",
            $value: 1,
        });
    });
});
