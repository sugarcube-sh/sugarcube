export const STUDIO_RPC = {
    SAVE: "sugarcube:studio:save",
    SHARED_STATE_DISK: "sugarcube:studio:disk",
    /** Key of Studio's block in the connection handshake's `configs`. */
    CONFIG: "sugarcube:studio",
} as const;

/** Studio's block of the connection handshake, baked in by the host. */
export type StudioConnectionConfig = {
    /** Where a save goes when there is no server to write files: a service that opens a pull request. */
    saveUrl?: string;
};
