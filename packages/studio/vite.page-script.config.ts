import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * The page script is imported into someone else's page by the hub, so it has
 * to be one self-contained module: devframe's channel code bundled in, nothing
 * left to resolve.
 */
export default defineConfig({
    build: {
        outDir: fileURLToPath(new URL("./dist", import.meta.url)),
        emptyOutDir: false,
        lib: {
            entry: fileURLToPath(new URL("./src/page/page-script.ts", import.meta.url)),
            formats: ["es"],
            fileName: () => "page-script.mjs",
        },
        rollupOptions: { external: [] },
    },
});
