---
"@sugarcube-sh/core": patch
---

`loadTokens` now reports which sources composed each context, in resolution order and with the text of every file, and the context the resolver names as the default. A source is a file and, where the resolver read one section of it, a JSON pointer into it: tokens declared inline in a resolver document report that document as their file; a group reports the last file that contributed to it in each context. `composeTrees`, on the client entry, rebuilds the trees from that text alone. `debounce` and `createCoalescedRunner` move here from the CLI and the Vite plugin. Nothing in the read path changes.
