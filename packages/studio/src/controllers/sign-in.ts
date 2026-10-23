import { ErrorMessages, UserFacingError } from "../error-messages";
import { type Access, type GitHost, KeyRefused, Refused } from "../git-hosts/git-host";
import { STUDIO_COOKIES, STUDIO_SIGN_IN_BASE, STUDIO_STORAGE } from "../studio-names";
import type { StudioSave } from "../protocol";
import { encodeEdits } from "./edits-text";
import { gitSave } from "./git-save";
import type { SaveShown, Studio } from "./studio";
import type { EditsStorage } from "./unsaved";
import { failedText } from "./views";

export interface Page {
    cookie(name: string): string | undefined;
    here(): string;
    go(url: string): void;
    readonly storage: EditsStorage | undefined;
    fetch(url: string, init: RequestInit): Promise<Response>;
}

export type SignInState = {
    readonly person: string | undefined;
    readonly access: Access | undefined;
    readonly said: string | undefined;
};

export interface SignIn {
    readonly repository: string;
    readonly state: SignInState;
    subscribe(listener: () => void): () => void;
    readonly save: StudioSave;
    start(studio: Pick<Studio, "unsaved" | "save">): Promise<void>;
    pressSave(studio: Pick<Studio, "unsaved" | "save">): Promise<void>;
    signOut(): Promise<void>;
}

export function createSignIn({
    page,
    repository,
    entry,
    hostFor,
    base = STUDIO_SIGN_IN_BASE,
}: {
    page: Page;
    repository: string;
    entry: string;
    hostFor: (login: string, key: () => Promise<string>) => GitHost;
    base?: string;
}): SignIn {
    const waitingKey = `${STUDIO_STORAGE.saveWaiting}${entry}`;
    const listeners = new Set<() => void>();
    let state: SignInState = {
        person: githubLogin(page.cookie(STUDIO_COOKIES.login)),
        access: undefined,
        said: undefined,
    };
    let host: { login: string; host: GitHost } | undefined;
    let heldKey: string | undefined;

    function set(change: Partial<SignInState>) {
        state = { ...state, ...change };
        for (const listener of listeners) listener();
    }

    function signedInHost(): GitHost | undefined {
        const { person } = state;
        if (person === undefined) return undefined;
        if (host?.login !== person) host = { login: person, host: hostFor(person, key) };
        return host.host;
    }

    async function key(): Promise<string> {
        heldKey ??= await keyFrom("key");
        if (heldKey) return heldKey;
        throw new KeyRefused("No key from the sign-in function");
    }

    async function refresh(): Promise<boolean> {
        heldKey = await keyFrom("refresh");
        return heldKey !== undefined;
    }

    async function keyFrom(address: "key" | "refresh"): Promise<string | undefined> {
        const response = await page
            .fetch(`${base}/${address}`, { method: "POST", credentials: "same-origin" })
            .catch(() => undefined);
        if (!response?.ok) return undefined;
        const answer = (await response.json().catch(() => undefined)) as
            | { key?: string }
            | undefined;
        return answer?.key;
    }

    async function withKey<T>(run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (error) {
            if (!(error instanceof KeyRefused)) throw error;
        }
        if (await refresh()) {
            try {
                return await run();
            } catch (error) {
                if (!(error instanceof KeyRefused)) throw error;
            }
        }
        set({ person: undefined, access: undefined });
        throw new UserFacingError(ErrorMessages.NOT_SIGNED_IN);
    }

    async function askAccess(signedIn: GitHost): Promise<Access> {
        const access = await withKey(() => signedIn.access());
        set({ access });
        return access;
    }

    const save: StudioSave = async (edits, changes) => {
        const signedIn = signedInHost();
        if (!signedIn) throw new UserFacingError(ErrorMessages.NOT_SIGNED_IN);
        try {
            return await withKey(() => gitSave({ host: signedIn, entry })(edits, changes));
        } catch (error) {
            if (error instanceof Refused) await askAccess(signedIn);
            throw error;
        }
    };

    function takeWaiting(): string | undefined {
        const waiting = page.storage?.getItem(waitingKey) ?? undefined;
        page.storage?.removeItem(waitingKey);
        return waiting;
    }

    return {
        repository,
        get state() {
            return state;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        save,
        async start(studio) {
            const waiting = takeWaiting();
            const signedIn = signedInHost();
            if (!signedIn) {
                if (waiting !== undefined) set({ said: ErrorMessages.NOT_SIGNED_IN });
                return;
            }
            const access = await askAccess(signedIn).catch((error: unknown) => {
                set({ said: failedText(error) });
                return undefined;
            });
            if (waiting === undefined || access?.can !== "write") return;
            if (waiting === (await encodeEdits(studio.unsaved))) await studio.save?.();
        },
        async pressSave(studio) {
            if (state.person !== undefined) {
                await studio.save?.();
                return;
            }
            set({ said: undefined });
            page.storage?.setItem(waitingKey, await encodeEdits(studio.unsaved));
            page.go(`${base}/sign-in?return=${encodeURIComponent(page.here())}`);
        },
        async signOut() {
            await page.fetch(`${base}/sign-out`, { method: "POST", credentials: "same-origin" });
            set({ person: undefined, access: undefined, said: undefined });
        },
    };
}

export function saveOffer({ person, access, said }: SignInState, repository: string): SaveOffer {
    const why = said === undefined ? {} : { reason: said };
    if (person === undefined) return { canSave: true, ...why };
    if (access === undefined) return { canSave: false, ...why };
    if (access.can === "write") return { canSave: true, ...why };
    if (access.can === "nothing" && access.reason === "not-installed") {
        const reason = ErrorMessages.NOT_INSTALLED(repository);
        return access.install
            ? { canSave: false, reason, install: access.install }
            : { canSave: false, reason };
    }
    return { canSave: false, reason: ErrorMessages.CANT_SAVE(repository) };
}

export type SaveOffer = { canSave: boolean; reason?: string; install?: string };

export function saveFor(signIn: SignIn | undefined): SaveOffer {
    return signIn ? saveOffer(signIn.state, signIn.repository) : { canSave: true };
}

export function signedInAs(signIn: SignIn | undefined): string | undefined {
    return signIn?.state.person;
}

export function pressSaveWith(
    studio: Pick<Studio, "unsaved" | "save">,
    signIn: SignIn | undefined,
): Promise<unknown> {
    return signIn ? signIn.pressSave(studio) : (studio.save?.() ?? Promise.resolve());
}

export function barMessages(
    saved: SaveShown | undefined,
    { reason, install }: SaveOffer,
): { outcome?: SaveShown; reason?: string; install?: string } {
    const outcome = reason !== undefined && saved && "failed" in saved ? undefined : saved;
    return {
        ...(outcome && { outcome }),
        ...(reason !== undefined && { reason }),
        ...(install !== undefined && { install }),
    };
}

const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

function githubLogin(given: string | undefined): string | undefined {
    return given !== undefined && GITHUB_LOGIN.test(given) ? given : undefined;
}
