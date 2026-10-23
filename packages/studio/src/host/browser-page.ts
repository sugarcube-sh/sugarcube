import type { Page } from "../controllers/sign-in";
import { cookieIn } from "../sign-in/cookies";

export function browserPage(): Page {
    return {
        cookie: (name) => cookieIn(document.cookie, name),
        here: () => `${location.pathname}${location.search}${location.hash}`,
        go: (url) => location.assign(url),
        storage: sessionStorageOf(),
        fetch: (url, init) => fetch(url, init),
    };
}

export function sessionStorageOf(): Storage | undefined {
    try {
        return globalThis.sessionStorage;
    } catch {
        return undefined;
    }
}
