import type { DesignTokens } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import {
    type Operation,
    combine,
    create,
    createSession,
    remove,
    rename,
    setValue,
} from "../src/index.js";
import { committed, demo, opened, opsIn, plainly, resolver } from "./helpers.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const blue = { colorSpace: "srgb", components: [0, 0, 1] };

const chain = () =>
    opened({
        "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
        "base.json": JSON.stringify({
            red: { $type: "color", $value: red },
            brand: { $type: "color", $value: "{red}" },
            text: { $type: "color", $value: "{brand}" },
        }),
    });

function inTurn(tokens: DesignTokens, operations: Operation[]) {
    return operations.reduce(
        (current, operation) => committed(current, operation(current)),
        tokens,
    );
}

describe("combine", () => {
    it("makes each operation from the design tokens the operations before it leave, as committing each in turn does", () => {
        const operations: Operation[] = [
            (current) => rename(current, "color.brand", "primary"),
            (current) => setValue(current, "color.primary.500", blue),
            (current) => remove(current, "radius.md"),
        ];
        const result = combine(demo, operations);

        expect(committed(demo, result).toMemory().files).toEqual(
            inTurn(demo, operations).toMemory().files,
        );
        const renamed = rename(demo, "color.brand", "primary");
        expect(result.ops && result.moves).toEqual(renamed.ops && renamed.moves);
    });

    it("gives what the operation gives, for one operation, and always what is left broken", () => {
        const operations: Operation[] = [
            (current) => setValue(current, "radius.md", 1),
            (current) => remove(current, "color.brand.500"),
            (current) => rename(current, "color.brand", "primary"),
        ];
        for (const operation of operations) {
            expect(plainly(combine(demo, [operation]))).toEqual({
                pathsWithBrokenReferences: [],
                ...plainly(operation(demo)),
            });
        }
    });

    it("changes nothing for no operations", () => {
        expect(plainly(combine(demo, []))).toEqual({
            ops: [],
            affectedPermutations: [],
            pathsWithBrokenReferences: [],
            moves: [],
        });
    });

    it("names every permutation any operation's change shows in, as the design tokens given hold them", () => {
        const result = combine(demo, [
            (current) => setValue(current, "radius.md", 1),
            (current) => setValue(current, "color.text.brand", "{color.brand.800}"),
        ]);

        expect(result.ops && result.affectedPermutations.inputs).toEqual([
            { mode: "light" },
            { mode: "dark" },
        ]);
        expect(
            result.ops &&
                result.affectedPermutations.every((each) => demo.permutations.includes(each)),
        ).toBe(true);
    });

    it("is refused, with that operation's reason, when any operation is", () => {
        const result = combine(demo, [
            (current) => setValue(current, "radius.md", 1),
            (current) => remove(current, "radius.nope"),
            (current) => setValue(current, "radius.lg", 2),
        ]);

        expect(result).toEqual(remove(demo, "radius.nope"));
    });

    it("asks an operation's question, and answering carries on with the operations after it", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }, { $ref: "./dark-extra.json" }],
            }),
            "base.json": JSON.stringify({
                bg: { $type: "color", $value: "#ffffff" },
                fg: { $type: "color", $value: "#000000" },
            }),
            "dark.json": "{}",
            "dark-extra.json": "{}",
        });
        const dark = { input: { mode: "dark" } };
        const before: Operation = (current) => setValue(current, "fg", "#111111");
        const asking: Operation = (current) => setValue(current, "bg", "#000000", dark);
        const after: Operation = (current) => rename(current, "fg", "ink");
        const result = combine(tokens, [before, asking, after]);

        expect(result.question).toMatchObject({ kind: "placement", path: "bg" });
        const answered = result.question?.answer("dark-extra.json") ?? result;
        const answering: Operation = (current) =>
            asking(current).question?.answer("dark-extra.json") ?? asking(current);
        expect(committed(tokens, answered).toMemory().files).toEqual(
            inTurn(tokens, [before, answering, after]).toMemory().files,
        );
        expect(result.question?.answer("base.json").question?.files).toStrictEqual([
            "dark.json",
            "dark-extra.json",
        ]);
        const other = result.question?.answer("dark.json") ?? result;
        expect(other.ops?.filter(({ file }) => file.startsWith("dark"))).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["bg"],
                value: { $type: "color", $value: "#000000" },
            },
        ]);
        expect(answered.ops?.filter(({ file }) => file.startsWith("dark"))).toEqual([
            {
                kind: "add",
                file: "dark-extra.json",
                jsonPath: ["bg"],
                value: { $type: "color", $value: "#000000" },
            },
        ]);
    });

    it("throws when an operation's edits were made from other design tokens", () => {
        expect(() =>
            combine(demo, [
                (current) => setValue(current, "radius.md", 1),
                () => setValue(demo, "radius.md", 2),
            ]),
        ).toThrow(
            "an operation's edits don't fit the design tokens it was given; make them from the tokens the operation is passed",
        );
    });

    it("is done by a session as one edit, whose ops are the unsaved edits", () => {
        const session = createSession(demo);
        const edit = combine(session.tokens, [
            (current) => setValue(current, "radius.md", 1),
            (current) => remove(current, "radius.lg"),
        ]);
        session.do(edit);

        expect(opsIn(session.unsavedEdits)).toEqual(edit.ops);
        expect(session.tokens.toMemory().files).toEqual(committed(demo, edit).toMemory().files);
    });
});

describe("combine, what is left referring to nothing", () => {
    it("lists what an operation leaves broken", () => {
        const result = combine(chain(), [(current) => remove(current, "red")]);

        expect(result.ops && result.pathsWithBrokenReferences).toEqual(["brand"]);
    });

    it("follows a broken token through a later operation's rename", () => {
        const result = combine(chain(), [
            (current) => remove(current, "red"),
            (current) => rename(current, "brand", "house"),
        ]);

        expect(result.ops && result.pathsWithBrokenReferences).toEqual(["house"]);
    });

    it("leaves out a broken token a later operation removes, and lists what that leaves broken", () => {
        const result = combine(chain(), [
            (current) => remove(current, "red"),
            (current) => remove(current, "brand"),
        ]);

        expect(result.ops && result.pathsWithBrokenReferences).toEqual(["text"]);
    });

    it("leaves out a broken token a later operation mends", () => {
        const result = combine(chain(), [
            (current) => remove(current, "red"),
            (current) => create(current, "red", { $type: "color", $value: red }),
        ]);

        expect(result.ops && result.pathsWithBrokenReferences).toEqual([]);
    });

    it("lists a token once when two operations leave it broken", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                red: { $type: "color", $value: red },
                blue: { $type: "color", $value: blue },
                fade: {
                    $type: "gradient",
                    $value: [
                        { color: "{red}", position: 0 },
                        { color: "{blue}", position: 1 },
                    ],
                },
            }),
        });
        const result = combine(tokens, [
            (current) => remove(current, "red"),
            (current) => remove(current, "blue"),
        ]);

        expect(result.ops && result.pathsWithBrokenReferences).toEqual(["fade"]);
    });
});
