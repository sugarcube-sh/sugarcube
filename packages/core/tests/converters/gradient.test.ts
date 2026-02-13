import { describe, expect, it } from "vitest";
import { convertGradientToken } from "../../src/converters/gradient.js";

describe("convertGradient", () => {
    it("should handle reference values", () => {
        const result = convertGradientToken("{gradients.primary}");
        expect(result).toEqual({
            value: "{gradients.primary}",
        });
    });

    it("should convert basic gradient", () => {
        const result = convertGradientToken([
            { color: "#000000", position: 0 },
            { color: "#FFFFFF", position: 1 },
        ]);

        expect(result).toEqual({
            value: "linear-gradient(#000000 0%, #FFFFFF 100%)",
        });
    });

    it("should handle references in color values", () => {
        const result = convertGradientToken([
            { color: "{color.primary}", position: 0 },
            { color: "{color.secondary}", position: 1 },
        ]);

        expect(result).toEqual({
            value: "linear-gradient({color.primary} 0%, {color.secondary} 100%)",
        });
    });

    it("should handle references in position values", () => {
        const result = convertGradientToken([
            { color: "#000000", position: "{position.start}" },
            { color: "#FFFFFF", position: "{position.end}" },
        ]);

        expect(result).toEqual({
            value: "linear-gradient(#000000 {position.start}%, #FFFFFF {position.end}%)",
        });
    });

    it("should handle multiple color stops", () => {
        const result = convertGradientToken([
            { color: "#000000", position: 0 },
            { color: "#808080", position: 0.5 },
            { color: "#FFFFFF", position: 1 },
        ]);

        expect(result).toEqual({
            value: "linear-gradient(#000000 0%, #808080 50%, #FFFFFF 100%)",
        });
    });
});
