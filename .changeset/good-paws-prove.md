---
"@sugarcube-sh/core": patch
"@sugarcube-sh/vite": patch
"@sugarcube-sh/cli": patch
---

Add CSS cascade layers support

**Vite plugin**: Pass `outputToCssLayers` via `unoOptions` to wrap output in `@layer` blocks:

```ts title="vite.config.ts"
sugarcube({
    unoOptions: {
        outputToCssLayers: {
            cssLayerName: (layer) => {
                if (layer === "preflights") return "base";
                if (layer === "default") return "utilities";
                return layer;
            }
        }
    }
})
```

CLI: Use output.layers to wrap generated CSS in @layer blocks:

```ts title="sugarcube.config.ts"
defineConfig({
    output: {
        layers: {
            variables: "base",
            utilities: "utilities"
        }
    }
})

```
