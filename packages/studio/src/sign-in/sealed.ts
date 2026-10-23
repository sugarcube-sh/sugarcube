import { fromBase64url, toBase64url } from "../base64url";

const IV_BYTES = 12;

export interface Sealer {
    seal(text: string, purpose: string): Promise<string>;
    open(sealed: string | undefined, purpose: string): Promise<string | undefined>;
}

export function sealerFor(secret: string): Sealer {
    const key = crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(secret))
        .then((bytes) =>
            crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]),
        );
    return {
        async seal(text, purpose) {
            const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
            const sealed = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(purpose) },
                await key,
                new TextEncoder().encode(text),
            );
            const bytes = new Uint8Array(iv.length + sealed.byteLength);
            bytes.set(iv);
            bytes.set(new Uint8Array(sealed), iv.length);
            return toBase64url(bytes);
        },
        async open(sealed, purpose) {
            if (!sealed) return undefined;
            try {
                const bytes = fromBase64url(sealed);
                const opened = await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv: bytes.slice(0, IV_BYTES),
                        additionalData: new TextEncoder().encode(purpose),
                    },
                    await key,
                    bytes.slice(IV_BYTES),
                );
                return new TextDecoder().decode(opened);
            } catch {
                return undefined;
            }
        },
    };
}
