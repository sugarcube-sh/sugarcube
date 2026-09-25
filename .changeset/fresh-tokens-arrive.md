---
"@sugarcube-sh/vite": patch
"@sugarcube-sh/cli": patch
---

Fixed a bug in the vite plugin. When you edited a token file or sugarcube.config.ts, the page didn't update until you reloaded it. The cause was a bug in UnoCSS 66.9, which the plugin uses to build the CSS. UnoCSS fixed it in 66.10.4, and the plugin now uses that version.
