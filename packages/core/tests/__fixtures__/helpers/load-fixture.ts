import fs from "node:fs";
import path from "node:path";

const FIXTURES_ROOT = path.join(__dirname, "..");

export function loadFixture<T>(fixturePath: string): T {
    const fullPath = path.join(FIXTURES_ROOT, fixturePath);

    try {
        const fixture = fs.readFileSync(fullPath, "utf-8");
        return JSON.parse(fixture);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load fixture at ${fixturePath}: ${error.message}`);
        }
        throw error;
    }
}
