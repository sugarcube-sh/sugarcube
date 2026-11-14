import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type LoadedConfig, fillDefaults } from "@sugarcube-sh/core";

const DEMO = join(__dirname, "../../demo");

export function copyDemo(): { dir: string; config: LoadedConfig["config"]; remove: () => void } {
    const dir = mkdtempSync(join(tmpdir(), "sugarcube-studio-"));
    cpSync(DEMO, dir, { recursive: true });
    const resolver = join(dir, "tokens.resolver.json");
    return {
        dir,
        config: { ...fillDefaults({ resolver }), resolver },
        remove: () => rmSync(dir, { recursive: true, force: true }),
    };
}
