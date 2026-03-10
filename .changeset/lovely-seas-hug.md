---
"@sugarcube-sh/vite": patch
---

Fix HMR not triggering when design token files change. Thanks @mark-tomlinson-dev

Removed `server.watcher.add()` calls for config and token file watching. Vite already watches the project root by default, so explicitly adding watch patterns was
unnecessary and caused intermittent failures due to chokidar timing issues. Now we simply listen for change events and filter for our files.
