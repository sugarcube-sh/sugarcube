---
"@sugarcube-sh/core": patch
---

Drop the `new Function` dynamic-import workaround in the Bun config-loading path. Jiti handles TypeScript configs natively in Bun now, so the extra branch isn't needed — and removing it clears the eval warning on socket.dev.
