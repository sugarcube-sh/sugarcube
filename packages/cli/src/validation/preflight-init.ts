import { configFileExists } from "@sugarcube-sh/core";
import { ERROR_MESSAGES } from "../constants/index.js";
import { errorBoxWithBadge } from "../prompts/box-with-badge.js";

export async function preflightInit(): Promise<void> {
    if (configFileExists()) {
        errorBoxWithBadge(ERROR_MESSAGES.CONFIG_EXISTS(), {});
        process.exit(1);
    }
}
