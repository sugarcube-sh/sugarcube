import { describe, expect, it } from "vitest";
import { oneFile } from "../token-files.js";

describe("a reference to a deprecated token", () => {
    it("is a warning, tagged deprecated", () => {
        const tokens = oneFile({
            color: {
                $type: "color",
                old: {
                    $value: { colorSpace: "srgb", components: [0.2, 0.4, 0.8] },
                    $deprecated: "Use color.new",
                },
                primary: { $value: "{color.old}" },
            },
        });
        expect(
            tokens.diagnostics.map(({ kind, severity, tags }) => ({ kind, severity, tags })),
        ).toStrictEqual([
            { kind: "deprecated-reference", severity: "warning", tags: ["deprecated"] },
        ]);
    });
});
