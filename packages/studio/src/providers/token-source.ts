/**
 * How Studio gets its token data.
 *
 * - devtools: Vite DevTools dock. Reads + writes via RPC. Server owns the pipeline.
 * - embedded: Web component iframe on a live/staging site. Snapshot via postMessage.
 *   Browser owns the pipeline.
 */
export type TokenSource = { mode: "devtools" } | { mode: "embedded" };
