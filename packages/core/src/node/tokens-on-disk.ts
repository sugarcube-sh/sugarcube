import type { TokensOnDisk } from "@sugarcube-sh/dtcg/node";
import { readOptions } from "../shared/read-options.js";
import type { LoadedConfig } from "./config/load.js";

export function tokensOnDisk(config: LoadedConfig["config"]): TokensOnDisk {
    return { entryFile: config.resolver, options: readOptions(config) };
}
