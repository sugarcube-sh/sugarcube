import { DEFAULT_CONFIG } from "@sugarcube-sh/core";
import color from "picocolors";
import { COMMANDS, VITE_PLUGIN } from "../constants/index.js";
import type { InitContext } from "../types/index.js";
import { infoBoxWithBadge } from "./box-with-badge.js";
import { sleep } from "./common.js";
import { log } from "./log.js";

const nextSteps = async (ctx: InitContext) => {
    log.space(2);
    await sleep(200);

    let content = "Next steps";

    if (ctx.pluginToInstall === VITE_PLUGIN) {
        content += "\n\n";
        content += "1. Configure the plugin\n";
        content += "   Add the plugin to your build configuration:\n";
        content += `   ${color.cyan("e.g. vite.config.ts or astro.config.mjs")}\n`;
        content += `   ${color.dim("plugins: [sugarcube()]")}`;

        content += "\n\n";
        content += "2. Import the generated CSS\n";
        content += `   ${color.cyan(`import 'virtual:sugarcube.css'`)}\n`;

        content += "\n\n";
        content += "3. (Optional) Add CUBE CSS\n";
        content += `   ${color.cyan(COMMANDS.CUBE)}`;

        content += "\n\n";
        content += "4. (Optional) Add components\n";
        content += `   ${color.cyan(COMMANDS.COMPONENTS)}`;
    } else {
        const cssPath = `${ctx.stylesDir}/global/${DEFAULT_CONFIG.output.variablesFilename}`;
        content += "\n\n";
        content += "1. Import the generated CSS\n";
        const importPath = ctx.isSrcDir ? `"${cssPath}"` : `"./${cssPath}"`;
        content += `   ${color.cyan(`import ${importPath}`)}`;
        content += "\n\n";
        content += "2. (Optional) Add CUBE CSS\n";
        content += `   ${color.cyan(COMMANDS.CUBE)}`;

        content += "\n\n";
        content += "3. (Optional) Add components\n";
        content += `   ${color.cyan(COMMANDS.COMPONENTS)}`;
    }

    content += "\n\n";
    content += `Docs: ${color.cyan("https://sugarcube.sh")}`;

    infoBoxWithBadge(content, { width: 0.75 });

    await sleep(200);
    log.break(1);
};

export async function next(ctx: InitContext): Promise<void> {
    await nextSteps(ctx);
}
