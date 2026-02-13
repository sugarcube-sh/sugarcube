import { describe, expect, it, vi } from "vitest";
import { isPackageInstalled } from "../src/detection/is-package-installed";

vi.mock("node:fs", () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
}));
import { existsSync, readFileSync } from "node:fs";

describe("isPackageInstalled", () => {
    it("returns true if package is in dependencies", () => {
        (existsSync as any).mockReturnValue(true);
        (readFileSync as any).mockReturnValue(
            JSON.stringify({ dependencies: { lodash: "^4.17.21" } })
        );
        expect(isPackageInstalled("lodash", "/fake/path")).toBe(true);
    });

    it("returns false if package.json does not exist", () => {
        (existsSync as any).mockReturnValue(false);
        expect(isPackageInstalled("lodash", "/fake/path")).toBe(false);
    });
});
