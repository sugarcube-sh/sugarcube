import { describe, expect, it } from "vitest";
import { plural } from "../src/plural.js";

describe("plural", () => {
    it("drops the s only at one", () => {
        expect(plural(0, "place")).toBe("0 places");
        expect(plural(1, "place")).toBe("1 place");
        expect(plural(2, "place")).toBe("2 places");
    });

    it("appends to whatever noun it is given", () => {
        expect(plural(1, "variable reference")).toBe("1 variable reference");
        expect(plural(3, "variable reference")).toBe("3 variable references");
    });
});
