import { describe, expect, it } from "vitest";
import { findDefaultContext } from "../src/shared/graph/build-token-graph";
import type { Permutation } from "../src/types/config";

const perms = (...inputs: Array<Record<string, string>>): Permutation[] =>
    inputs.map((input) => ({ input, selector: ":root" }));

describe("findDefaultContext", () => {
    it("picks the permutation whose input matches every modifier default", () => {
        const found = findDefaultContext(
            ["perm:0", "perm:1"],
            perms({ mode: "light" }, { mode: "dark" }),
            { mode: "light" },
        );

        expect(found).toBe("perm:0");
    });

    it("does not assume index zero", () => {
        const found = findDefaultContext(
            ["perm:0", "perm:1"],
            perms({ mode: "dark" }, { mode: "light" }),
            { mode: "light" },
        );

        expect(found).toBe("perm:1");
    });

    it("treats an empty input as the default", () => {
        const found = findDefaultContext(["perm:0", "perm:1"], perms({}, { mode: "dark" }), {
            mode: "light",
        });

        expect(found).toBe("perm:0");
    });

    it("needs every modifier to match, not just one", () => {
        const found = findDefaultContext(
            ["perm:0", "perm:1"],
            perms({ mode: "light", brand: "b" }, { mode: "light", brand: "a" }),
            { mode: "light", brand: "a" },
        );

        expect(found).toBe("perm:1");
    });

    it("gives no answer rather than a wrong one when several could be default", () => {
        const found = findDefaultContext(["perm:0", "perm:1"], perms({}, {}), { mode: "light" });

        expect(found).toBeUndefined();
    });

    it("gives no answer when the defaults are unknown", () => {
        const found = findDefaultContext(
            ["perm:0", "perm:1"],
            perms({ mode: "light" }, { mode: "dark" }),
            undefined,
        );

        expect(found).toBeUndefined();
    });

    it("treats a lone context with no permutation behind it as the whole output", () => {
        expect(findDefaultContext(["default"], undefined, undefined)).toBe("default");
        expect(findDefaultContext(["perm:0", "perm:1"], undefined, undefined)).toBeUndefined();
    });
});
