---
"@sugarcube-sh/core": minor
---

A mistake in `sugarcube.config.ts` now names the actual setting that's wrong, instead of just crashing.

For consumers building on core directly: `cssFrom` makes a design system's CSS in one step, `problemsText` prints problems the way the CLI and Vite do, and `ConfigError` carries each mistake as `issues`; `extractFileRefs`, `writeCSSVariablesToDisk`, `writeCSSUtilitiesToDisk`, `debounce`, `PerfMonitor` and `Instrumentation` are removed.
