import { ErrorMessages } from "../error-messages";
import { STUDIO_COOKIES, STUDIO_SETTINGS } from "../studio-names";
import { type CookieOptions, cookieFrom, setCookie } from "./cookies";
import { type GitHubApp, type Tokens, githubSignIn } from "./github";
import { pathOnThisSite } from "./return-path";
import { sealerFor } from "./sealed";

export type SignInSettings = Readonly<Record<string, string | undefined>>;

export type SignInOptions = {
    readonly fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export type SignInRoute = (request: Request) => Promise<Response>;

type Trip = { readonly state: string; readonly back: string };

type StudioCookie = (typeof STUDIO_COOKIES)[keyof typeof STUDIO_COOKIES];

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const SIGN_IN_LASTS = 15897600;
const STATE_LASTS = 600;
const SECRET_LENGTH = 32;

export function signIn(
    settings: SignInSettings = processEnv(),
    options: SignInOptions = {},
): { GET: SignInRoute; POST: SignInRoute } {
    const route = signInRoute(settings, options);
    return { GET: route, POST: route };
}

function signInRoute(
    settings: SignInSettings,
    { fetch = globalThis.fetch }: SignInOptions,
): SignInRoute {
    return async (request) => {
        const read = settingsFrom(settings);
        if ("problem" in read) return new Response(read.problem, { status: 500 });
        const { app, secret } = read;
        const github = githubSignIn(app, fetch);
        const sealer = sealerFor(secret);

        const url = new URL(request.url);
        const cut = url.pathname.lastIndexOf("/");
        const base = url.pathname.slice(0, cut);
        const address = url.pathname.slice(cut + 1);
        const secure = url.protocol === "https:";
        const forPage: CookieOptions = { maxAge: 0, path: "/", httpOnly: false, secure };
        const forFunction: CookieOptions = { maxAge: 0, path: base, httpOnly: true, secure };
        const cookieOptions: Record<StudioCookie, CookieOptions> = {
            [STUDIO_COOKIES.key]: forFunction,
            [STUDIO_COOKIES.login]: forPage,
            [STUDIO_COOKIES.refresh]: forFunction,
            [STUDIO_COOKIES.state]: forFunction,
        };
        const callback = `${url.origin}${base}/callback`;

        const cleared = (...names: StudioCookie[]) =>
            names.map((name) => setCookie(name, "", cookieOptions[name]));
        const signedOut = () =>
            cleared(STUDIO_COOKIES.key, STUDIO_COOKIES.login, STUDIO_COOKIES.refresh);

        async function signedIn(tokens: Tokens, login: string): Promise<string[]> {
            const lasts = tokens.refresh_token_expires_in ?? SIGN_IN_LASTS;
            const refresh = tokens.refresh_token
                ? [
                      setCookie(
                          STUDIO_COOKIES.refresh,
                          await sealer.seal(tokens.refresh_token, STUDIO_COOKIES.refresh),
                          {
                              ...cookieOptions[STUDIO_COOKIES.refresh],
                              maxAge: lasts,
                          },
                      ),
                  ]
                : [];
            return [
                setCookie(
                    STUDIO_COOKIES.key,
                    await sealer.seal(tokens.access_token, STUDIO_COOKIES.key),
                    {
                        ...cookieOptions[STUDIO_COOKIES.key],
                        maxAge: tokens.expires_in ?? lasts,
                    },
                ),
                setCookie(STUDIO_COOKIES.login, login, {
                    ...cookieOptions[STUDIO_COOKIES.login],
                    maxAge: lasts,
                }),
                ...refresh,
            ];
        }

        async function refreshed(): Promise<Response> {
            const refresh = await sealer.open(
                cookieFrom(request, STUDIO_COOKIES.refresh),
                STUDIO_COOKIES.refresh,
            );
            if (!refresh) return respond(401, signedOut());
            const tokens = await github.tokens({
                grant_type: "refresh_token",
                refresh_token: refresh,
            });
            const login = tokens && (await github.login(tokens.access_token));
            if (!tokens || !login) return respond(401, []);
            return respond(200, await signedIn(tokens, login), {
                body: { key: tokens.access_token },
            });
        }

        const routes: Record<string, { method: string; answer: () => Promise<Response> }> = {
            "sign-in": {
                method: "GET",
                answer: async () => {
                    const state = randomState();
                    const back = pathOnThisSite(url.searchParams.get("return"), url.origin);
                    const to = new URL(GITHUB_AUTHORIZE);
                    to.searchParams.set("client_id", app.clientId);
                    to.searchParams.set("redirect_uri", callback);
                    to.searchParams.set("state", state);
                    const trip = await sealer.seal(
                        JSON.stringify({ state, back } satisfies Trip),
                        STUDIO_COOKIES.state,
                    );
                    return respond(
                        302,
                        [
                            setCookie(STUDIO_COOKIES.state, trip, {
                                ...cookieOptions[STUDIO_COOKIES.state],
                                maxAge: STATE_LASTS,
                            }),
                        ],
                        { location: to.href },
                    );
                },
            },
            "callback": {
                method: "GET",
                answer: async () => {
                    const opened = await sealer.open(
                        cookieFrom(request, STUDIO_COOKIES.state),
                        STUDIO_COOKIES.state,
                    );
                    const trip = opened === undefined ? undefined : (JSON.parse(opened) as Trip);
                    const back = new URL(trip?.back ?? "/", url.origin).href;
                    const clearState = cleared(STUDIO_COOKIES.state);
                    const code = url.searchParams.get("code");
                    if (!trip || trip.state !== url.searchParams.get("state") || !code)
                        return respond(302, clearState, { location: back });
                    const tokens = await github.tokens({ code, redirect_uri: callback });
                    const login = tokens && (await github.login(tokens.access_token));
                    if (!tokens || !login) return respond(302, clearState, { location: back });
                    return respond(302, [...clearState, ...(await signedIn(tokens, login))], {
                        location: back,
                    });
                },
            },
            "key": {
                method: "POST",
                answer: async () => {
                    const key = await sealer.open(
                        cookieFrom(request, STUDIO_COOKIES.key),
                        STUDIO_COOKIES.key,
                    );
                    return key ? respond(200, [], { body: { key } }) : refreshed();
                },
            },
            "refresh": { method: "POST", answer: refreshed },
            "sign-out": {
                method: "POST",
                answer: async () => {
                    const key = await sealer.open(
                        cookieFrom(request, STUDIO_COOKIES.key),
                        STUDIO_COOKIES.key,
                    );
                    if (key) await github.revoke(key);
                    return respond(204, signedOut());
                },
            },
        };

        const route = routes[address];
        if (!route) return new Response(null, { status: 404 });
        if (request.method !== route.method)
            return new Response(null, { status: 405, headers: { allow: route.method } });
        if (route.method === "POST" && fromAnotherSite(request, url.origin))
            return new Response(null, { status: 403 });
        return route.answer();
    };
}

function settingsFrom(
    settings: SignInSettings,
): { app: GitHubApp; secret: string } | { problem: string } {
    const clientId = settings[STUDIO_SETTINGS.clientId];
    const clientSecret = settings[STUDIO_SETTINGS.clientSecret];
    const secret = settings[STUDIO_SETTINGS.secret];
    if (!clientId) return { problem: ErrorMessages.MISSING_SETTING(STUDIO_SETTINGS.clientId) };
    if (!clientSecret)
        return { problem: ErrorMessages.MISSING_SETTING(STUDIO_SETTINGS.clientSecret) };
    if (!secret) return { problem: ErrorMessages.MISSING_SETTING(STUDIO_SETTINGS.secret) };
    if (secret.length < SECRET_LENGTH)
        return { problem: ErrorMessages.SHORT_SECRET(STUDIO_SETTINGS.secret, SECRET_LENGTH) };
    return { app: { clientId, clientSecret }, secret };
}

function fromAnotherSite(request: Request, origin: string): boolean {
    const from = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    return (from !== null && from !== origin) || (site !== null && site !== "same-origin");
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

function randomState(): string {
    return [...crypto.getRandomValues(new Uint8Array(24))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function processEnv(): SignInSettings {
    return (globalThis as { process?: { env?: SignInSettings } }).process?.env ?? {};
}
