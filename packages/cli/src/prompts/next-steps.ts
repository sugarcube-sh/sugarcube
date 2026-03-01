import color from "picocolors";
import { LINKS } from "../constants/links.js";
import { infoBoxWithBadge } from "./box-with-badge.js";
import { sleep } from "./common.js";
import { log } from "./log.js";

export interface NextStepsContext {
    installedVitePlugin: boolean;
}

export async function next(ctx: NextStepsContext): Promise<void> {
    log.space(2);
    await sleep(200);

    const lines: string[] = ["Next steps", ""];

    if (ctx.installedVitePlugin) {
        lines.push(`Add the plugin to your ${color.cyan("vite.config.ts")}:`);
        lines.push("");
        lines.push(color.dim("  import sugarcube from '@sugarcube-sh/vite'"));
        lines.push(color.dim(""));
        lines.push(color.dim("  export default defineConfig({"));
        lines.push(color.dim("    plugins: [await sugarcube()],"));
        lines.push(color.dim("  })"));
    } else {
        lines.push(`Generate CSS: ${color.cyan("npx sugarcube generate")}`);
    }

    lines.push("");
    lines.push(`Stuck? ${color.cyan(LINKS.DOCS)}`);

    infoBoxWithBadge(lines.join("\n"), { width: 0.75 });

    await sleep(200);
    log.break(1);
}
