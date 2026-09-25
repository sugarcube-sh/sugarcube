export const STUDIO_RPC = {
    SAVE: "sugarcube:studio:save",
    SHARED_STATE_DISK: "sugarcube:studio:disk",
    /** Not a method: studio's key in the handshake's `configs`. */
    CONFIG: "sugarcube:studio",
} as const;

/** Settings the host publishes in the handshake for clients to read. */
export type StudioConnectionConfig = {
    /** Where saves go when there's no server to write files, e.g. a service that opens a PR. */
    saveUrl?: string;
};
