import { describe, expect, it } from "vitest";
import { fileChange, resolveMarkupWatchTargets } from "../src/watch/watcher.js";

describe("resolveMarkupWatchTargets", () => {
    it("falls back to the working directory when no content is configured", () => {
        expect(resolveMarkupWatchTargets(undefined)).toEqual(["."]);
        expect(resolveMarkupWatchTargets([])).toEqual(["."]);
    });

    it("derives static base dirs from content globs", () => {
        expect(
            resolveMarkupWatchTargets(["/root/lib/**/*.heex", "/root/assets/js/**/*.js"]),
        ).toEqual(["/root/lib", "/root/assets/js"]);
    });

    it("dedupes base dirs shared by multiple globs", () => {
        expect(resolveMarkupWatchTargets(["/root/lib/**/*.heex", "/root/lib/**/*.ex"])).toEqual([
            "/root/lib",
        ]);
    });

    it("ignores negation globs — they scope output, not what to watch", () => {
        expect(
            resolveMarkupWatchTargets(["/root/lib/**/*.heex", "!/root/lib/**/vendor/**"]),
        ).toEqual(["/root/lib"]);
    });
});

describe("fileChange", () => {
    const watched = {
        tokens: ["C:/project/tokens/base.json"],
        config: "C:/project/sugarcube.config.ts",
        markup: true,
    };

    it("is a config change for the config file, whichever way its slashes are written", () => {
        expect(fileChange("C:\\project\\sugarcube.config.ts", watched)).toBe("config");
        expect(fileChange("C:/project/sugarcube.config.ts", watched)).toBe("config");
    });

    it("is a token change for any other file", () => {
        expect(fileChange("C:\\project\\tokens\\base.json", watched)).toBe("token");
    });
});
