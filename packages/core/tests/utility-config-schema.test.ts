import { describe, expect, it } from "vitest";
import { ErrorMessages } from "../src/shared/constants/error-messages.js";
import { userConfigSchema } from "../src/shared/schemas/config.js";

function issues(classes: unknown) {
    const result = userConfigSchema.safeParse({ utilities: { classes } });
    return result.success ? [] : result.error.issues.map(({ message }) => message);
}

describe("utility classes schema", () => {
    it("accepts a source ending in .*, and one with no wildcard", () => {
        expect(
            issues({
                "color": { source: "color.*", prefix: "text" },
                "font-weight": { source: "font.weight.*" },
                "--accent": { source: "color.brand", prefix: "accent" },
            }),
        ).toStrictEqual([]);
    });

    it("refuses a wildcard anywhere but the end, naming the property", () => {
        expect(issues({ color: { source: "color.*.bg", prefix: "text" } })).toStrictEqual([
            ErrorMessages.UTILITIES.INVALID_SOURCE_PATTERN("color", "color.*.bg"),
        ]);
        expect(
            issues({
                margin: [
                    { source: "space.*", prefix: "m" },
                    { source: "space*", prefix: "m" },
                ],
            }),
        ).toStrictEqual([ErrorMessages.UTILITIES.INVALID_SOURCE_PATTERN("margin", "space*")]);
    });
});
