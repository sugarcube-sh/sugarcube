import { fileURLToPath } from "node:url";
import { basename, dirname } from "node:path";
import { defineConfig } from "vite";
import { BUILT_PAGE_SCRIPT } from "./src/built-files";

// The page script runs in the user's page, so it must bundle everything it
// needs rather than import it.
export default defineConfig({
    build: {
        outDir: dirname(BUILT_PAGE_SCRIPT),
        emptyOutDir: true,
        lib: {
            entry: fileURLToPath(new URL("./src/page/page-script.ts", import.meta.url)),
            formats: ["es"],
            fileName: () => basename(BUILT_PAGE_SCRIPT),
        },
        rollupOptions: { external: [] },
    },
});
