import { describe, expect, it } from "vitest";
import { getCookie } from "../../src/sign-in/cookies";

describe("a cookie from the header the browser keeps", () => {
    it("is found by its exact name", () => {
        const header = "other-sugarcube-studio-login=no; theme=dark; sugarcube-studio-login=mark";
        expect(getCookie(header, "sugarcube-studio-login")).toBe("mark");
    });

    it("keeps an equals sign inside the value", () => {
        expect(getCookie("sealed=abc==; x=1", "sealed")).toBe("abc==");
    });

    it("is undefined when it isn't there", () => {
        expect(getCookie("", "sugarcube-studio-login")).toBeUndefined();
        expect(getCookie("theme=dark", "sugarcube-studio-login")).toBeUndefined();
    });
});
