---
"@sugarcube-sh/vite": patch
---

A token or config file that fails to load while the dev server is running is now logged and the server carries on. Before this, a save mid-edit that broke `sugarcube.config.ts` could take the whole dev server down.
