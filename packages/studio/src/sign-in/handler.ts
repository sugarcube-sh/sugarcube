import { ErrorMessages } from "../error-messages";
import { STUDIO_COOKIES, STUDIO_SETTINGS } from "../studio-names";
import { type CookieOptions, getRequestCookie, serializeCookie } from "./cookies";
import { type GitHubApp, type GitHubTokens, createGitHubSignIn } from "./github";
import { getSafeReturnPath } from "./return-path";
import { createSealer } from "./sealed";

export type SignInSettings = Readonly<Record<string, string | undefined>>;

export type SignInOptions = {
    readonly fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export type SignInRoute = (request: Request) => Promise<Response>;

type OAuthState = { readonly state: string; readonly returnPath: string };

type StudioCookieName = (typeof STUDIO_COOKIES)[keyof typeof STUDIO_COOKIES];

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const SIGN_IN_MAX_AGE = 15897600;
const STATE_MAX_AGE = 600;
const MIN_SECRET_LENGTH = 32;

export function signIn(
    settings: SignInSettings = getProcessEnv(),
    options: SignInOptions = {},
): { GET: SignInRoute; POST: SignInRoute } {
    const route = createSignInRoute(settings, options);
    return { GET: route, POST: route };
}

function createSignInRoute(
    settings: SignInSettings,
    { fetch = globalThis.fetch }: SignInOptions,
): SignInRoute {
    return async (request) => {
        const parsedSettings = readSettings(settings);
        if ("problem" in parsedSettings)
            return new Response(parsedSettings.problem, { status: 500 });
        const { app, secret } = parsedSettings;
        const github = createGitHubSignIn(app, fetch);
        const sealer = createSealer(secret);

        const url = new URL(request.url);
        const lastSlash = url.pathname.lastIndexOf("/");
        const base = url.pathname.slice(0, lastSlash);
        const routeName = url.pathname.slice(lastSlash + 1);
        const secure = url.protocol === "https:";
        const pageCookieOptions: CookieOptions = { maxAge: 0, path: "/", httpOnly: false, secure };
        const functionCookieOptions: CookieOptions = {
            maxAge: 0,
            path: base,
            httpOnly: true,
            secure,
        };
        const cookieOptions: Record<StudioCookieName, CookieOptions> = {
            [STUDIO_COOKIES.key]: functionCookieOptions,
            [STUDIO_COOKIES.login]: pageCookieOptions,
            [STUDIO_COOKIES.refresh]: functionCookieOptions,
            [STUDIO_COOKIES.state]: functionCookieOptions,
        };
        const callback = `${url.origin}${base}/callback`;

        const clearCookies = (...names: StudioCookieName[]) =>
            names.map((name) => serializeCookie(name, "", cookieOptions[name]));
        const clearSignInCookies = () =>
            clearCookies(STUDIO_COOKIES.key, STUDIO_COOKIES.login, STUDIO_COOKIES.refresh);

        async function createSignInCookies(tokens: GitHubTokens, login: string): Promise<string[]> {
            const maxAge = tokens.refresh_token_expires_in ?? SIGN_IN_MAX_AGE;
            const refresh = tokens.refresh_token
                ? [
                      serializeCookie(
                          STUDIO_COOKIES.refresh,
                          await sealer.seal(tokens.refresh_token, STUDIO_COOKIES.refresh),
                          {
                              ...cookieOptions[STUDIO_COOKIES.refresh],
                              maxAge,
                          },
                      ),
                  ]
                : [];
            return [
                serializeCookie(
                    STUDIO_COOKIES.key,
                    await sealer.seal(tokens.access_token, STUDIO_COOKIES.key),
                    {
                        ...cookieOptions[STUDIO_COOKIES.key],
                        maxAge: tokens.expires_in ?? maxAge,
                    },
                ),
                serializeCookie(STUDIO_COOKIES.login, login, {
                    ...cookieOptions[STUDIO_COOKIES.login],
                    maxAge,
                }),
                ...refresh,
            ];
        }

        async function refreshSignIn(): Promise<Response> {
            const refresh = await sealer.unseal(
                getRequestCookie(request, STUDIO_COOKIES.refresh),
                STUDIO_COOKIES.refresh,
            );
            if (!refresh) return respond(401, clearSignInCookies());
            const tokens = await github.requestTokens({
                grant_type: "refresh_token",
                refresh_token: refresh,
            });
            const login = tokens && (await github.getLogin(tokens.access_token));
            if (!tokens || !login) return respond(401, []);
            return respond(200, await createSignInCookies(tokens, login), {
                body: { key: tokens.access_token },
            });
        }

        const routes: Record<string, { method: string; handle: () => Promise<Response> }> = {
            "sign-in": {
                method: "GET",
                handle: async () => {
                    const state = createRandomState();
                    const returnPath = getSafeReturnPath(
                        url.searchParams.get("return"),
                        url.origin,
                    );
                    const authorizeURL = new URL(GITHUB_AUTHORIZE);
                    authorizeURL.searchParams.set("client_id", app.clientID);
                    authorizeURL.searchParams.set("redirect_uri", callback);
                    authorizeURL.searchParams.set("state", state);
                    const sealedState = await sealer.seal(
                        JSON.stringify({ state, returnPath } satisfies OAuthState),
                        STUDIO_COOKIES.state,
                    );
                    return respond(
                        302,
                        [
                            serializeCookie(STUDIO_COOKIES.state, sealedState, {
                                ...cookieOptions[STUDIO_COOKIES.state],
                                maxAge: STATE_MAX_AGE,
                            }),
                        ],
                        { location: authorizeURL.href },
                    );
                },
            },
            "callback": {
                method: "GET",
                handle: async () => {
                    const stateJSON = await sealer.unseal(
                        getRequestCookie(request, STUDIO_COOKIES.state),
                        STUDIO_COOKIES.state,
                    );
                    const oauthState =
                        stateJSON === undefined ? undefined : (JSON.parse(stateJSON) as OAuthState);
                    const returnURL = new URL(oauthState?.returnPath ?? "/", url.origin).href;
                    const expiredStateCookies = clearCookies(STUDIO_COOKIES.state);
                    const code = url.searchParams.get("code");
                    if (!oauthState || oauthState.state !== url.searchParams.get("state") || !code)
                        return respond(302, expiredStateCookies, { location: returnURL });
                    const tokens = await github.requestTokens({ code, redirect_uri: callback });
                    const login = tokens && (await github.getLogin(tokens.access_token));
                    if (!tokens || !login)
                        return respond(302, expiredStateCookies, { location: returnURL });
                    return respond(
                        302,
                        [...expiredStateCookies, ...(await createSignInCookies(tokens, login))],
                        {
                            location: returnURL,
                        },
                    );
                },
            },
            "key": {
                method: "POST",
                handle: async () => {
                    const key = await sealer.unseal(
                        getRequestCookie(request, STUDIO_COOKIES.key),
                        STUDIO_COOKIES.key,
                    );
                    return key ? respond(200, [], { body: { key } }) : refreshSignIn();
                },
            },
            "refresh": { method: "POST", handle: refreshSignIn },
            "sign-out": {
                method: "POST",
                handle: async () => {
                    const key = await sealer.unseal(
                        getRequestCookie(request, STUDIO_COOKIES.key),
                        STUDIO_COOKIES.key,
                    );
                    if (key) await github.revoke(key);
                    return respond(204, clearSignInCookies());
                },
            },
        };

        const route = routes[routeName];
        if (!route) return new Response(null, { status: 404 });
        if (request.method !== route.method)
            return new Response(null, { status: 405, headers: { allow: route.method } });
        if (route.method === "POST" && isCrossSite(request, url.origin))
            return new Response(null, { status: 403 });
        return route.handle();
    };
}

function readSettings(
    settings: SignInSettings,
): { app: GitHubApp; secret: string } | { problem: string } {
    const clientID = settings[STUDIO_SETTINGS.clientID];
    const clientSecret = settings[STUDIO_SETTINGS.clientSecret];
    const secret = settings[STUDIO_SETTINGS.secret];
    if (!clientID) return { problem: ErrorMessages.MISSING_SETTING(STUDIO_SETTINGS.clientID) };
    if (!clientSecret)
        return { problem: ErrorMessages.MISSING_SETTING(STUDIO_SETTINGS.clientSecret) };
    if (!secret) return { problem: ErrorMessages.MISSING_SETTING(STUDIO_SETTINGS.secret) };
    if (secret.length < MIN_SECRET_LENGTH)
        return { problem: ErrorMessages.SHORT_SECRET(STUDIO_SETTINGS.secret, MIN_SECRET_LENGTH) };
    return { app: { clientID, clientSecret }, secret };
}

function isCrossSite(request: Request, origin: string): boolean {
    const requestOrigin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    return (
        (requestOrigin !== null && requestOrigin !== origin) ||
        (site !== null && site !== "same-origin")
    );
}

function respond(
    status: number,
    cookies: readonly string[],
    { location, body }: { location?: string; body?: unknown } = {},
): Response {
    const headers = new Headers({ "cache-control": "no-store" });
    if (location) headers.set("location", location);
    if (body !== undefined) headers.set("content-type", "application/json");
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

function createRandomState(): string {
    return [...crypto.getRandomValues(new Uint8Array(24))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function getProcessEnv(): SignInSettings {
    return (globalThis as { process?: { env?: SignInSettings } }).process?.env ?? {};
}
