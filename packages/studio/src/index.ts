/**
 * Public API for the studio package — consumed by `@sugarcube-sh/studio-vite`
 * and other host integrations. Internal modules (the React SPA, hooks,
 * stores, controls) are deliberately not re-exported here.
 */

export { computeDiff } from "./tokens/compute-diff";
export { diffToFileEdits } from "./tokens/diff-to-edits";
export { PathIndex } from "./tokens/path-index";
export type { FileEdits, TokenEdit } from "./tokens/diff-to-edits";
export type {
    PathIndexEntry,
    SlimToken,
    TokenDiffEntry,
    TokenSnapshot,
    TokenUpdate,
} from "./tokens/types";
