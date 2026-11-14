import { createAdapter } from "../adapters";
import type { SignIn } from "../controllers/sign-in";
import { type Studio, createStudio } from "../controllers/studio";
import { persistUnsavedEdits } from "../controllers/unsaved";
import { ErrorMessages } from "../error-messages";
import { STUDIO_STORAGE } from "../studio-names";
import { getSessionStorage } from "./browser-page";
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

type OpenStudioConnection = Omit<StudioConnection, "signIn"> & {
    readonly signIn?: Pick<SignIn, "start"> | undefined;
};

export async function openStudio(
    { message: sharedMessage, save, signIn }: OpenStudioConnection,
    signal: AbortSignal,
    { waitMs = WAIT_MS }: { waitMs?: number } = {},
): Promise<Studio> {
    const firstMessage =
        sharedMessage.value() ?? (await waitForMessage(sharedMessage, signal, waitMs));
    const studio = createStudio(firstMessage, createAdapter, save);
    const storage = getSessionStorage();
    const restored = storage
        ? persistUnsavedEdits(studio, storage, `${STUDIO_STORAGE.unsaved}${firstMessage.entryFile}`)
        : Promise.resolve();
    void restored.then(() => signIn?.start(studio));
    const stop = sharedMessage.on("updated", (next) => studio.receive(next));
    signal.addEventListener("abort", () => {
        stop();
        studio.destroy();
    });
    return studio;
}

function waitForMessage(
    sharedMessage: SharedMessage,
    signal: AbortSignal,
    waitMs: number,
): Promise<StudioMessage> {
    return new Promise((resolve, reject) => {
        const cleanUp = () => {
            stop();
            clearTimeout(timer);
            signal.removeEventListener("abort", handleAbort);
        };
        const stop = sharedMessage.on("updated", (next) => {
            cleanUp();
            resolve(next);
        });
        const timer = setTimeout(() => {
            cleanUp();
            reject(new Error(ErrorMessages.NO_MESSAGE));
        }, waitMs);
        const handleAbort = () => {
            cleanUp();
            reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", handleAbort, { once: true });
    });
}
