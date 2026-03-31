---
"@sugarcube-sh/core": patch
---

### Fluid dimensions as extension

Fluid dimensions are now expressed as a standard `dimension` token with an `sh.sugarcube.fluid` extension, replacing the non-standard `fluidDimension` token type:

```json
{
  "$type": "dimension",
  "$value": { "value": 1, "unit": "rem" },
  "$extensions": {
    "sh.sugarcube": {
      "fluid": {
        "min": { "value": 0.875, "unit": "rem" },
        "max": { "value": 1.5, "unit": "rem" }
      }
    }
  }
}
```

The `$value` serves as a static fallback while `fluid.min` and `fluid.max` define the clamp range. This aligns with the DTCG spec's extension mechanism and makes fluid tokens interoperable with tools that understand standard `dimension` tokens.

`$type: "fluidDimension"` still works but produces a deprecation warning.

### Fluid extension validation

The `sh.sugarcube.fluid` extension is now validated — `min` and `max` must both be valid dimension objects with numeric values and `px`/`rem` units. Previously, invalid fluid values would pass validation and fail silently at conversion.

### Pipeline context

Introduces `PipelineContext`, a shared context threaded through pipeline stages for emitting warnings and events:

- Any pipeline stage can emit warnings via `context.warn()` without changing its return type
- Warnings are automatically deduplicated by path + message (fixes duplicate warnings when tokens appear across multiple permutations)
- Consumers (CLI, Vite plugin, Studio) can provide an `emit` handler for real-time pipeline events
- Exported as `createPipelineContext()` for consumer use

### Warning and error deduplication

Validation errors are now deduplicated — the same token appearing across multiple permutations no longer produces duplicate error messages.

### Warning messages

Warning messages are now centralized in `WarningMessages` (mirroring the existing `ErrorMessages` pattern), separating them from error messages.

### Pipeline refactor

Resolver document parsing is now a distinct pipeline stage (`parseResolver`), separating it from token loading. This gives the pipeline context access to resolver warnings directly rather than forwarding them after the fact.
