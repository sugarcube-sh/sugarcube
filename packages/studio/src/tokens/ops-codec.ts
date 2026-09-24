import type { WriteOp } from "./write-ops";

/**
 * An operation list as one URL-safe string: gzip through the browser's own
 * CompressionStream, then base64url. Small, because it carries what was done
 * over a baseline rather than the document itself. The carrier is whoever
 * needs it: session storage for a dock that reloads with its page, a URL for a
 * playground over a starter kit.
 */
export async function encodeOps(ops: readonly WriteOp[]): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(ops));
    const compressed = await pipe(bytes, new CompressionStream("gzip"));
    return base64url(compressed);
}

export async function decodeOps(text: string): Promise<WriteOp[]> {
    const bytes = await pipe(fromBase64url(text), new DecompressionStream("gzip"));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) throw new Error("Not an operation list");
    return parsed as WriteOp[];
}

async function pipe(bytes: Uint8Array, through: GenericTransformStream): Promise<Uint8Array> {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(through);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function base64url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/={1,2}$/, "");
}

function fromBase64url(text: string): Uint8Array {
    const padded = text
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(text.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
