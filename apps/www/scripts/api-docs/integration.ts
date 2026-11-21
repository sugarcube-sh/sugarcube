import type { AstroIntegration } from "astro";
import { generateApiDocs, sourceDirectory } from "./generate.ts";

export function apiReference(): AstroIntegration {
    return {
        name: "api-reference",
        hooks: {
            "astro:server:setup": ({ server, logger }) => {
                let running = false;
                let again = false;
                const regenerate = () => {
                    if (running) {
                        again = true;
                        return;
                    }
                    running = true;
                    try {
                        const { pages } = generateApiDocs();
                        logger.info(`Rewrote ${pages} reference pages`);
                    } catch (error) {
                        logger.error(error instanceof Error ? error.message : String(error));
                    } finally {
                        running = false;
                    }
                    if (again) {
                        again = false;
                        regenerate();
                    }
                };
                server.watcher.add(sourceDirectory);
                for (const event of ["change", "add", "unlink"]) {
                    server.watcher.on(event, (file: string) => {
                        if (file.startsWith(sourceDirectory)) regenerate();
                    });
                }
            },
        },
    };
}
