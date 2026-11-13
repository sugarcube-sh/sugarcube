import { resolve } from "pathe";
import type { TokensOnDisk } from "@sugarcube-sh/dtcg/node";
import { createReadOptions } from "../shared/read-options.js";
import type { LoadedConfig } from "./config/load.js";

export function getTokensOnDisk(config: LoadedConfig["config"], root?: string): TokensOnDisk {
    const entryFile = root === undefined ? config.resolver : resolve(root, config.resolver);
    return { entryFile, options: createReadOptions(config) };
}
