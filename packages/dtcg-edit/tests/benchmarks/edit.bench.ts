import type { DesignTokens } from "@sugarcube-sh/dtcg";
import { bench, describe } from "vitest";
import {
    type OpResult,
    commit,
    create,
    createSession,
    remove,
    rename,
    setDescription,
    setValue,
} from "../../src/index.js";
import { designTokens } from "./design-tokens.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const dark = { input: { theme: "dark" } };

const operations: [string, (tokens: DesignTokens) => OpResult][] = [
    ["setValue, the shared value", (p) => setValue(p, "color.c0", red)],
    ["setValue, dark's override", (p) => setValue(p, "color.c0", red, dark)],
    ["setValue, a new override for dark", (p) => setValue(p, "color.c1", red, dark)],
    ["setDescription, written in two files", (p) => setDescription(p, "color.c0", "Red.")],
    ["create a token", (p) => create(p, "color.fresh", { $value: red })],
    ["create a group", (p) => create(p, "color.fresh", { group: true })],
    ["remove a token", (p) => remove(p, "color.c2")],
    ["remove a group", (p) => remove(p, "space")],
    ["rename the group 100 references point into", (p) => rename(p, "color", "colour")],
];

function edits(name: string, opened: DesignTokens) {
    describe(name, () => {
        bench("read alone", () => {
            opened.reread({});
        });
        for (const [label, operation] of operations) {
            const result = operation(opened);
            bench(`${label}: read again, then the operation`, () => {
                operation(opened.reread({}));
            });
            bench(`${label}: commit`, () => {
                commit(opened, result);
            });
        }
        const kept = createSession(opened);
        kept.do(setValue(kept.tokens, "color.c0", red));
        kept.do(setValue(kept.tokens, "space.s0", { value: 3, unit: "rem" }));
        bench("restore two edits after a reload", () => {
            createSession(opened).restore(kept.unsaved);
        });
        bench("restore two edits, then rebase onto the files changed on disk", () => {
            const editing = createSession(opened);
            editing.restore(kept.unsaved);
            editing.rebase(opened);
        });
        bench("restore two edits, rebase, then undo the last", () => {
            const editing = createSession(opened);
            editing.restore(kept.unsaved);
            editing.rebase(opened);
            editing.undo();
        });
        const undoing = createSession(opened);
        undoing.do(setValue(undoing.tokens, "color.c0", red));
        undoing.do(rename(undoing.tokens, "color", "colour"));
        bench("undo a rename, then redo it", () => {
            undoing.undo();
            undoing.redo();
        });
        const session = createSession(opened);
        let turn = 0;
        bench("setValue, the shared value: operation and session.do", () => {
            turn += 1;
            const value = { ...red, alpha: turn % 2 ? 1 : 0.5 };
            session.do(setValue(session.tokens, "color.c0", value));
        });
    });
}

edits("150 tokens a group, 450 in all", designTokens(150));
edits("the same, with 150 more a generator makes", designTokens(150, { generated: 150 }));
