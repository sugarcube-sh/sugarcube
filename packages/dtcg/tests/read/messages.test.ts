import { describe, expect, it } from "vitest";
import { diagnosticMessages } from "../../src/error-messages.js";
import type { DiagnosticDetailByKind, DiagnosticKind } from "../../src/index.js";

const examples: { [K in DiagnosticKind]: DiagnosticDetailByKind[K][] } = {
    "file-not-found": [
        { file: "dark.json" },
        { file: "dark.json", referencedFrom: "tokens.resolver.json" },
    ],
    "invalid-json": [
        { reason: "comment" },
        { reason: "not-an-object" },
        { reason: "comma-expected" },
    ],
    "duplicate-key": [{ key: "brand" }],
    "resolver-invalid": [
        { rule: "version", name: "version", at: ["version"] },
        { rule: "missing-property", name: "sources", at: ["sets", "base"] },
        { rule: "wrong-type", name: "sources", at: ["sets", "base", "sources"], expected: "array" },
        { rule: "unknown-item-type", name: "group", at: ["resolutionOrder", 0, "type"] },
        {
            rule: "resolver-as-source",
            name: "other.resolver.json",
            at: ["sets", "base", "sources", 0],
        },
        { rule: "unknown-set", name: "base", at: ["resolutionOrder", 0, "$ref"] },
        { rule: "unknown-modifier", name: "theme", at: ["resolutionOrder", 1, "$ref"] },
        { rule: "invalid-pointer", name: "#/modifiers/theme", at: ["sets", "base", "sources", 0] },
        { rule: "circular-reference", name: "#/sets/base", at: ["sets", "base", "sources", 0] },
        { rule: "duplicate-name", name: "base", at: ["resolutionOrder", 1, "name"] },
        { rule: "no-contexts", name: "theme", at: ["modifiers", "theme", "contexts"] },
        { rule: "single-context", name: "theme", at: ["modifiers", "theme", "contexts"] },
        { rule: "invalid-default", name: "theme", at: ["modifiers", "theme", "default"] },
    ],
    "input-invalid": [
        { reason: "unknown-modifier", modifier: "size" },
        { reason: "unknown-context", modifier: "theme", context: "blue", valid: ["light", "dark"] },
        { reason: "missing-modifier", modifier: "theme" },
        { reason: "not-a-string", modifier: "beta" },
    ],
    "invalid-name": [
        { name: "$brand", character: "$" },
        { name: "a.b", character: "." },
    ],
    "token-and-group": [{}],
    "invalid-member": [
        { name: "brand", found: "string" },
        { name: "sizes", found: "array" },
    ],
    "invalid-property": [
        { property: "$description", expected: "string" },
        { property: "$deprecated", expected: "boolean-or-string" },
        { property: "$extensions", expected: "object" },
        { property: "$extends", expected: "reference" },
    ],
    "missing-type": [{}],
    "unknown-type": [{ type: "colour" }],
    "invalid-value": [{ type: "color", at: ["$value"], reason: "wrong-shape" }],
    "hex-string-color": [{ value: "#e11d48" }],
    "extension-invalid": [
        { key: "sh.sugarcube", at: ["$extensions", "sh.sugarcube", "scale", "mode"] },
    ],
    "missing-reference": [{ ref: "color.brnad", referencedBy: ["color.danger"] }],
    "not-a-group": [{ ref: "color.brand" }],
    "not-a-token": [{ ref: "color.accent" }],
    "reference-to-several": [{ ref: "shadow.layered", count: 3 }],
    "circular-reference": [{ chain: ["color.a", "color.b", "color.a"] }],
    "type-mismatch": [{ ref: "space.md", expected: "color", found: "dimension" }],
    "whitespace-in-name": [{ name: "brand " }],
    "permutation-limit": [{ count: 16384, limit: 64, built: 15 }],
    "no-default": [{ modifiers: ["size"] }, { modifiers: ["size", "theme"] }],
    "deprecated-reference": [{ ref: "color.old" }, { ref: "color.old", reason: "use color.brand" }],
};

const messages = (Object.keys(examples) as DiagnosticKind[]).flatMap((kind) =>
    examples[kind].map((detail) => ({
        kind,
        message: (diagnosticMessages[kind].message as (detail: unknown) => string)(detail),
    })),
);

describe("diagnostic messages", () => {
    it("has an entry for every kind", () => {
        expect(Object.keys(diagnosticMessages).sort()).toStrictEqual(Object.keys(examples).sort());
    });

    it.for(messages)("words $kind as plain text: $message", ({ message }) => {
        expect(message).not.toBe("");
        expect(message).toMatch(/^[^A-Z]/);
        expect(message).not.toMatch(/\.$/);
        expect(message).not.toMatch(/(^|\s)(sugarcube|npx|pnpm|npm)\s|\s--?[a-z]/);
        expect(message).not.toMatch(/did you mean/i);
    });
});
