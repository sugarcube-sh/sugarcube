import { resolve } from "pathe";
import type { TokensOnDisk } from "@sugarcube-sh/dtcg/node";
import { readOptions } from "../shared/read-options.js";
import type { LoadedConfig } from "./config/load.js";

export function tokensOnDisk(config: LoadedConfig["config"], root?: string): TokensOnDisk {
    const entryFile = root === undefined ? config.resolver : resolve(root, config.resolver);
    return { entryFile, options: readOptions(config) };
}
