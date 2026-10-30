import { join } from "node:path";
import type { ReadText } from "../../src/index.js";
import { textOnDisk } from "../../src/node/read.js";

export function textIn(folder: string): ReadText {
    return (path) => textOnDisk(join(folder, path));
}
