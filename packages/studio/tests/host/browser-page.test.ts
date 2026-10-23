import { describe, expect, it } from "vitest";
import { cookieIn } from "../../src/sign-in/cookies";

describe("a cookie from the header the browser keeps", () => {
    it("is found by its exact name", () => {
        const header = "other-sugarcube-studio-login=no; theme=dark; sugarcube-studio-login=mark";
        expect(cookieIn(header, "sugarcube-studio-login")).toBe("mark");
    });

    it("keeps an equals sign inside the value", () => {
        expect(cookieIn("sealed=abc==; x=1", "sealed")).toBe("abc==");
    });

    it("is undefined when it isn't there", () => {
        expect(cookieIn("", "sugarcube-studio-login")).toBeUndefined();
        expect(cookieIn("theme=dark", "sugarcube-studio-login")).toBeUndefined();
    });
});
