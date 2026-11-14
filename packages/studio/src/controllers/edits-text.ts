import { type Edits, isEdits } from "@sugarcube-sh/dtcg-edit";
import { fromBase64url, toBase64url } from "../base64url";

export async function encodeEdits(edits: Edits): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(edits));
    return toBase64url(await pipeBytes(bytes, new CompressionStream("gzip")));
}

export async function decodeEdits(text: string): Promise<Edits | undefined> {
    try {
        const bytes = await pipeBytes(fromBase64url(text), new DecompressionStream("gzip"));
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        return isEdits(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

async function pipeBytes(
    bytes: Uint8Array,
    transform: GenericTransformStream,
): Promise<Uint8Array> {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
