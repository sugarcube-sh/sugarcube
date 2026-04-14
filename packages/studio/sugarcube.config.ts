import { defineConfig } from "@sugarcube-sh/vite";

export default defineConfig({
    resolver: "src/client/design-tokens/tokens.resolver.json",
    components: "src/client/components/ui",
    cube: "src/client/styles",
});
