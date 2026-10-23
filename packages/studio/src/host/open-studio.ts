import { adapterFor } from "../adapters";
import type { SignIn } from "../controllers/sign-in";
import { type Studio, createStudio } from "../controllers/studio";
import { keepUnsaved } from "../controllers/unsaved";
import { ErrorMessages } from "../error-messages";
import { STUDIO_STORAGE } from "../studio-names";
import type { StudioMessage, StudioSave } from "../protocol";

const WAIT_MS = 10_000;

export interface SharedMessage {
    value(): StudioMessage | undefined;
    on(event: "updated", listener: (value: StudioMessage) => void): () => void;
}

export interface StudioConnection {
    readonly message: SharedMessage;
    readonly save?: StudioSave | undefined;
    readonly signIn?: SignIn | undefined;
}

type Opening = Omit<StudioConnection, "signIn"> & {
    readonly signIn?: Pick<SignIn, "start"> | undefined;
};

export async function openStudio(
    { message: shared, save, signIn }: Opening,
    signal: AbortSignal,
    { waitMs = WAIT_MS }: { waitMs?: number } = {},
): Promise<Studio> {
    const first = shared.value() ?? (await arrived(shared, signal, waitMs));
    const studio = createStudio(first, adapterFor, save);
    const storage = sessionStorageOf();
    const restored = storage
        ? keepUnsaved(studio, storage, `${STUDIO_STORAGE.unsaved}${first.entry}`)
        : Promise.resolve();
    void restored.then(() => signIn?.start(studio));
    const stop = shared.on("updated", (next) => studio.receive(next));
    signal.addEventListener("abort", () => {
        stop();
        studio.destroy();
    });
    return studio;
}

function arrived(
    shared: SharedMessage,
    signal: AbortSignal,
    waitMs: number,
): Promise<StudioMessage> {
    return new Promise((resolve, reject) => {
        const done = () => {
            stop();
            clearTimeout(timer);
            signal.removeEventListener("abort", aborted);
        };
        const stop = shared.on("updated", (next) => {
            done();
            resolve(next);
        });
        const timer = setTimeout(() => {
            done();
            reject(new Error(ErrorMessages.NO_MESSAGE));
        }, waitMs);
        const aborted = () => {
            done();
            reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", aborted, { once: true });
    });
}

function sessionStorageOf(): Storage | undefined {
    try {
        return globalThis.sessionStorage;
    } catch {
        return undefined;
    }
}
