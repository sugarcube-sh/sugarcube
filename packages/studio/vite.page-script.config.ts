import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * The page script is imported into someone else's page by the hub, so it has
 * to be one self-contained module: devframe's channel code bundled in, nothing
 * left to resolve. It gets a folder of its own because a hub hosts the folder
 * the script sits in, and nothing else from `dist` should ride along.
 */
export default defineConfig({
    build: {
        outDir: fileURLToPath(new URL("./dist/page-script", import.meta.url)),
        emptyOutDir: true,
        lib: {
            entry: fileURLToPath(new URL("./src/page/page-script.ts", import.meta.url)),
            formats: ["es"],
            fileName: () => "page-script.mjs",
        },
        rollupOptions: { external: [] },
    },
});
