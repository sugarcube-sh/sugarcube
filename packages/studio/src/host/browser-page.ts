import type { Page } from "../controllers/sign-in";
import { getCookie } from "../sign-in/cookies";

export function createBrowserPage(): Page {
    return {
        getCookie: (name) => getCookie(document.cookie, name),
        getReturnPath: () => `${location.pathname}${location.search}${location.hash}`,
        redirect: (url) => location.assign(url),
        storage: getSessionStorage(),
        fetch: (url, init) => fetch(url, init),
    };
}

export function getSessionStorage(): Storage | undefined {
    try {
        return globalThis.sessionStorage;
    } catch {
        return undefined;
    }
}
