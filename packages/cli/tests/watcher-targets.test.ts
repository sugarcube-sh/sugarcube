import { describe, expect, it } from "vitest";
import { ignoredMarkup, resolveMarkupWatchTargets } from "../src/watch/watcher.js";

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

describe("ignoredMarkup", () => {
    it("skips folders such as node_modules whichever way the slashes are written", () => {
        expect(ignoredMarkup("C:\\project\\node_modules\\lib")).toBe(true);
        expect(ignoredMarkup("/project/node_modules/lib")).toBe(true);
        expect(ignoredMarkup("C:\\project\\src")).toBe(false);
    });
});
