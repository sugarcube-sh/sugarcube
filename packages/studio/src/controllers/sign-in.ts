import { ErrorMessages, UserFacingError } from "../error-messages";
import {
    type Access,
    type GitHost,
    UnauthorizedError,
    AccessDeniedError,
} from "../git-hosts/git-host";
import { STUDIO_COOKIES, STUDIO_SIGN_IN_BASE, STUDIO_STORAGE } from "../studio-names";
import type { StudioSave } from "../protocol";
import { encodeEdits } from "./edits-text";
import { createGitSave } from "./git-save";
import type { SaveStatus, Studio } from "./studio";
import type { EditsStorage } from "./unsaved";
import { formatSaveError } from "./views";

export interface Page {
    getCookie(name: string): string | undefined;
    getReturnPath(): string;
    redirect(url: string): void;
    readonly storage: EditsStorage | undefined;
    fetch(url: string, init: RequestInit): Promise<Response>;
}

export type SignInState = {
    readonly login: string | undefined;
    readonly access: Access | undefined;
    readonly message: string | undefined;
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
    createHost,
    base = STUDIO_SIGN_IN_BASE,
}: {
    page: Page;
    repository: string;
    entry: string;
    createHost: (login: string, key: () => Promise<string>) => GitHost;
    base?: string;
}): SignIn {
    const pendingSaveKey = `${STUDIO_STORAGE.pendingSave}${entry}`;
    const listeners = new Set<() => void>();
    let state: SignInState = {
        login: parseGitHubLogin(page.getCookie(STUDIO_COOKIES.login)),
        access: undefined,
        message: undefined,
    };
    let host: { login: string; host: GitHost } | undefined;
    let cachedKey: string | undefined;

    function setState(change: Partial<SignInState>) {
        state = { ...state, ...change };
        for (const listener of listeners) listener();
    }

    function getSignedInHost(): GitHost | undefined {
        const { login } = state;
        if (login === undefined) return undefined;
        if (host?.login !== login) host = { login, host: createHost(login, getKey) };
        return host.host;
    }

    async function getKey(): Promise<string> {
        cachedKey ??= await fetchKey("key");
        if (cachedKey) return cachedKey;
        throw new UnauthorizedError("No key from the sign-in function");
    }

    async function refresh(): Promise<boolean> {
        cachedKey = await fetchKey("refresh");
        return cachedKey !== undefined;
    }

    async function fetchKey(address: "key" | "refresh"): Promise<string | undefined> {
        const response = await page
            .fetch(`${base}/${address}`, { method: "POST", credentials: "same-origin" })
            .catch(() => undefined);
        if (!response?.ok) return undefined;
        const body = (await response.json().catch(() => undefined)) as { key?: string } | undefined;
        return body?.key;
    }

    async function runWithKey<T>(run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (error) {
            if (!(error instanceof UnauthorizedError)) throw error;
        }
        if (await refresh()) {
            try {
                return await run();
            } catch (error) {
                if (!(error instanceof UnauthorizedError)) throw error;
            }
        }
        setState({ login: undefined, access: undefined });
        throw new UserFacingError(ErrorMessages.NOT_SIGNED_IN);
    }

    async function checkAccess(signedIn: GitHost): Promise<Access> {
        const access = await runWithKey(() => signedIn.getAccess());
        setState({ access });
        return access;
    }

    const save: StudioSave = async (edits, changes) => {
        const signedIn = getSignedInHost();
        if (!signedIn) throw new UserFacingError(ErrorMessages.NOT_SIGNED_IN);
        try {
            return await runWithKey(() => createGitSave({ host: signedIn, entry })(edits, changes));
        } catch (error) {
            if (error instanceof AccessDeniedError) await checkAccess(signedIn);
            throw error;
        }
    };

    function takePendingSave(): string | undefined {
        const waiting = page.storage?.getItem(pendingSaveKey) ?? undefined;
        page.storage?.removeItem(pendingSaveKey);
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
            const waiting = takePendingSave();
            const signedIn = getSignedInHost();
            if (!signedIn) {
                if (waiting !== undefined) setState({ message: ErrorMessages.NOT_SIGNED_IN });
                return;
            }
            const access = await checkAccess(signedIn).catch((error: unknown) => {
                setState({ message: formatSaveError(error) });
                return undefined;
            });
            if (waiting === undefined || access?.can !== "write") return;
            if (waiting === (await encodeEdits(studio.unsaved))) await studio.save?.();
        },
        async pressSave(studio) {
            if (state.login !== undefined) {
                await studio.save?.();
                return;
            }
            setState({ message: undefined });
            page.storage?.setItem(pendingSaveKey, await encodeEdits(studio.unsaved));
            page.redirect(`${base}/sign-in?return=${encodeURIComponent(page.getReturnPath())}`);
        },
        async signOut() {
            await page.fetch(`${base}/sign-out`, { method: "POST", credentials: "same-origin" });
            setState({ login: undefined, access: undefined, message: undefined });
        },
    };
}

export function toSaveOffer(
    { login, access, message }: SignInState,
    repository: string,
): SaveOffer {
    const messageField = message === undefined ? {} : { reason: message };
    if (login === undefined) return { canSave: true, ...messageField };
    if (access === undefined) return { canSave: false, ...messageField };
    if (access.can === "write") return { canSave: true, ...messageField };
    if (access.can === "nothing" && access.reason === "not-installed") {
        const reason = ErrorMessages.NOT_INSTALLED(repository);
        return access.installURL
            ? { canSave: false, reason, installURL: access.installURL }
            : { canSave: false, reason };
    }
    return { canSave: false, reason: ErrorMessages.CANT_SAVE(repository) };
}

export type SaveOffer = { canSave: boolean; reason?: string; installURL?: string };

export function getSaveOffer(signIn: SignIn | undefined): SaveOffer {
    return signIn ? toSaveOffer(signIn.state, signIn.repository) : { canSave: true };
}

export function getLogin(signIn: SignIn | undefined): string | undefined {
    return signIn?.state.login;
}

export function startSave(
    studio: Pick<Studio, "unsaved" | "save">,
    signIn: SignIn | undefined,
): Promise<unknown> {
    return signIn ? signIn.pressSave(studio) : (studio.save?.() ?? Promise.resolve());
}

export function getBarMessages(
    saved: SaveStatus | undefined,
    { reason, installURL }: SaveOffer,
): { outcome?: SaveStatus; reason?: string; installURL?: string } {
    const outcome = reason !== undefined && saved && "failed" in saved ? undefined : saved;
    return {
        ...(outcome && { outcome }),
        ...(reason !== undefined && { reason }),
        ...(installURL !== undefined && { installURL }),
    };
}

const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

function parseGitHubLogin(given: string | undefined): string | undefined {
    return given !== undefined && GITHUB_LOGIN_PATTERN.test(given) ? given : undefined;
}
