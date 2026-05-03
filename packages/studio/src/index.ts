/**
 * Public API for the studio package — consumed by `@sugarcube-sh/studio-vite`
 * and other host integrations. Internal modules (the React SPA, hooks,
 * stores, controls) are deliberately not re-exported here.
 */

export type { FileEdits, TokenEdit } from "./tokens/diff-to-edits";
export type { SaveBundle } from "./host/types";
export type {
    PathIndexEntry,
    SlimToken,
    TokenDiffEntry,
    TokenSnapshot,
    TokenUpdate,
} from "./tokens/types";
