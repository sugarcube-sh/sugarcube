---
"@sugarcube-sh/core": minor
---

It's now an error for two tokens to write the same CSS variable. Before, the first one's value quietly never reached the CSS.

If you build on core directly, `loadInternalConfig` replaces `loadSugarcubeConfig`: you give it the settings that should win over the config file's, such as a command's flags, and it gives back the config and the file it came from, throwing `ConfigError` when something about the config is wrong. The steps `generate` builds with are exported as well: `readOptions`, `declare`, `emitCSS`, `utilityTokens`, `utilityRules` and `writeCSSFiles`.
