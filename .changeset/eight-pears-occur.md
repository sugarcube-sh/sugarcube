---
"@sugarcube-sh/core": patch
"@sugarcube-sh/cli": patch
---

Add a `content` config option that tells the CLI which source files to scan for token and utility usage. Until now, `generate` and `lint` only ever looked at the directory you ran them from and everything below it, so projects that keep sugarcube installed apart from their markup had no way to scan it. Set `content` to a list of globs and both commands read from wherever your files actually live:

```ts
export default defineConfig({
  content: ["./**/*.{js,ts}", "../../templates/**/*.html"]
});
```

The globs are resolved relative to your config file rather than your working directory, so a config that sits in a subfolder can still reach files above it with ../, and you keep running sugarcube from the same place as before. generate picks up utility class names from your markup and lint picks up var() references from your CSS, each ignoring the file types it doesn't care about, so listing a folder broadly is fine. Prefix a glob with ! to exclude paths. Watch mode follows content too, regenerating when those files change. When content is omitted, scanning behaves exactly as before, so this is fully backward compatible. Only the CLI reads this option; the Vite plugin discovers usage through the bundler's module graph.

