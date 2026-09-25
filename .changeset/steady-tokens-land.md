---
"@sugarcube-sh/cli": patch
---

`generate --watch` no longer loses a token change when a markup file changes within a moment of it. Both regenerate, tokens first; before, the markup change replaced the token one and `tokens.css` kept the old values until the next token edit.
