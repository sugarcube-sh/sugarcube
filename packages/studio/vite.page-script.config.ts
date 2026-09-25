import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The page script runs in the user's page, so it must bundle everything it
// needs rather than import it.
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
