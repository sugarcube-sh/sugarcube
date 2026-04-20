import { fileURLToPath } from "node:url";
import sugarcube from "@sugarcube-sh/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./src", import.meta.url));
const outDir = fileURLToPath(new URL("./dist/client", import.meta.url));

export default defineConfig({
    root,
    base: "/__studio/",
    plugins: [react(), sugarcube()],
    build: {
        outDir,
        emptyOutDir: true,
    },
});
