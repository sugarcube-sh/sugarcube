import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach } from "vitest";

export function useTempFolder(prefix: string) {
    const folder = {
        path: "",
        at: (path: string) => join(folder.path, path),
        async files(written: Record<string, string>): Promise<void> {
            for (const [path, text] of Object.entries(written)) {
                await mkdir(dirname(folder.at(path)), { recursive: true });
                await writeFile(folder.at(path), text);
            }
        },
    };
    beforeEach(async () => {
        folder.path = await realpath(await mkdtemp(join(tmpdir(), prefix)));
    });
    afterEach(async () => {
        await rm(folder.path, { recursive: true, force: true });
    });
    return folder;
}
