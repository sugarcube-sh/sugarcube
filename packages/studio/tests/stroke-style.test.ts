import { describe, expect, it } from "vitest";
import { readStrokeStyle } from "../src/tokens/stroke-style";

describe("readStrokeStyle", () => {
    it("reads each keyword", () => {
        expect(readStrokeStyle("solid")).toBe("solid");
        expect(readStrokeStyle("dashed")).toBe("dashed");
        expect(readStrokeStyle("inset")).toBe("inset");
    });

    it("has no keyword to read in a dash array, so the picker stays disabled", () => {
        const custom = {
            dashArray: [
                { value: 2, unit: "px" },
                { value: 4, unit: "px" },
            ],
            lineCap: "round",
        };
        expect(readStrokeStyle(custom)).toBeUndefined();
    });

    it("has nothing to read in a reference or an unknown name", () => {
        expect(readStrokeStyle("{border.style.default}")).toBeUndefined();
        expect(readStrokeStyle("wavy")).toBeUndefined();
        expect(readStrokeStyle(undefined)).toBeUndefined();
    });
});
