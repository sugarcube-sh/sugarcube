import { defineConfig } from "@sugarcube-sh/vite";

export default defineConfig({
    resolver: "registry/tokens/starter-kits/fluid/tokens.resolver.json",
    output: {
        cssRoot: "src/styles",
        components: "src/ui/components",
    },
    utilities: {
        padding: {
            source: "space.*",
            prefix: "p",
            directions: ["all"],
        },
        margin: {
            source: "space.*",
            prefix: "m",
            directions: ["all"],
        },
        "--flow-space": {
            source: "space.*",
            prefix: "flow-space",
        },
        "--region-space": {
            source: "space.*",
            prefix: "region-space",
        },
        "--cluster-gap": {
            source: "space.*",
            prefix: "cluster-gap",
        },
        "--switcher-gap": {
            source: "space.*",
            prefix: "switcher-gap",
        },
        "--grid-gap": {
            source: "space.*",
            prefix: "grid-gap",
        },
        "--wrapper-max-width": {
            source: "container.*",
            prefix: "wrapper-max-width",
        },
        gap: {
            source: "space.*",
            prefix: "gap",
        },
        color: {
            source: "color.*",
            prefix: "text",
            stripDuplicates: true,
        },
        "background-color": {
            source: "color.*",
            prefix: "bg",
        },
        "font-size": {
            source: "text.*",
        },
        "font-weight": {
            source: "font.weight.*",
            prefix: "font-weight",
        },
        "letter-spacing": {
            source: "tracking.*",
        },
        "border-radius": {
            source: "radius.*",
            prefix: "rounded",
        },
    },
});
