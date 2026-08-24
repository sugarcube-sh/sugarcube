import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/shared/constants/error-messages.js";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { TokenTree } from "../src/types/tokens.js";

function tree(tokens: Record<string, unknown>): TokenTree {
    return { context: "perm:0", sourcePath: "tokens.json", tokens } as TokenTree;
}

describe("missing reference grouping", () => {
    it("collapses direct referrers of one missing token into a single capped message", () => {
        const colors: Record<string, unknown> = { $type: "color" };
        for (const name of ["surface", "border", "background", "text", "ring"]) {
            colors[name] = { $value: "{color.orange}" };
        }

        const { errors } = resolveTokens([tree({ color: colors })]);

        expect(errors.resolution).toHaveLength(1);
        const error = errors.resolution[0];
        expect(error?.ref).toBe("color.orange");
        const referrers = [
            "color.background",
            "color.border",
            "color.ring",
            "color.surface",
            "color.text",
        ];
        expect(error?.referencedBy).toEqual(referrers);
        expect(error?.message).toBe(
            ErrorMessages.RESOLVE.MISSING_REFERENCE("color.orange", referrers),
        );
    });

    it("suppresses transitive referrers, reporting at the direct reference site", () => {
        const { errors } = resolveTokens([
            tree({
                color: {
                    $type: "color",
                    a: { $value: "{color.b}" },
                    b: { $value: "{color.c}" },
                },
            }),
        ]);

        expect(errors.resolution).toHaveLength(1);
        const error = errors.resolution[0];
        expect(error?.ref).toBe("color.c");
        expect(error?.referencedBy).toEqual(["color.b"]);
        expect(error?.message).toBe(
            ErrorMessages.RESOLVE.MISSING_REFERENCE("color.c", ["color.b"]),
        );
    });

    it("reports distinct missing tokens separately", () => {
        const { errors } = resolveTokens([
            tree({
                color: {
                    $type: "color",
                    x: { $value: "{color.orange}" },
                    y: { $value: "{color.pink}" },
                },
            }),
        ]);

        expect(errors.resolution).toHaveLength(2);
    });
});
