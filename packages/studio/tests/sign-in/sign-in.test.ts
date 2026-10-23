import { describe, expect, it } from "vitest";
import { signIn } from "../../src/sign-in";
import { STUDIO_COOKIES, STUDIO_SETTINGS, STUDIO_SIGN_IN_BASE } from "../../src/studio-names";

const SITE = "https://acme.com";
const BASE = `${SITE}${STUDIO_SIGN_IN_BASE}`;

const env = {
    [STUDIO_SETTINGS.clientId]: "Iv1.client",
    [STUDIO_SETTINGS.clientSecret]: "client-secret",
    [STUDIO_SETTINGS.secret]: "a long random secret for encrypting",
};

function routed(handlers: ReturnType<typeof signIn>) {
    return (request: Request) =>
        (request.method === "POST" ? handlers.POST : handlers.GET)(request);
}

type Asked = { method: string; url: string; body: unknown; authorization: string | null };

function github({
    swaps = true,
    refreshes = true,
    expiring = true,
}: { swaps?: boolean; refreshes?: boolean; expiring?: boolean } = {}) {
    const asked: Asked[] = [];
    const used = new Set<string>();
    let issued = 0;
    const tokens = () => {
        issued++;
        return expiring
            ? {
                  access_token: `ghu_key${issued}`,
                  expires_in: 28800,
                  refresh_token: `ghr_refresh${issued}`,
                  refresh_token_expires_in: 15897600,
                  token_type: "bearer",
              }
            : { access_token: `ghu_key${issued}`, token_type: "bearer" };
    };
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        const text = await request.text();
        const body = text ? JSON.parse(text) : undefined;
        asked.push({
            method: request.method,
            url: request.url,
            body,
            authorization: request.headers.get("authorization"),
        });
        const json = (value: unknown, status = 200) =>
            new Response(JSON.stringify(value), {
                status,
                headers: { "content-type": "application/json" },
            });
        if (request.url === "https://github.com/login/oauth/access_token") {
            if (body.grant_type === "refresh_token") {
                if (!refreshes || used.has(body.refresh_token))
                    return json({ error: "bad_refresh_token" });
                used.add(body.refresh_token);
                return json(tokens());
            }
            return json(
                swaps && body.code === "the-code" ? tokens() : { error: "bad_verification_code" },
            );
        }
        if (request.url === "https://api.github.com/user") return json({ login: "mark", id: 1 });
        if (request.url.startsWith("https://api.github.com/applications/"))
            return new Response(null, { status: 204 });
        return json({ message: "Not Found" }, 404);
    };
    return { fetch, asked };
}

type Cookie = { value: string; attributes: Map<string, string> };

function cookiesOf(response: Response): Map<string, Cookie> {
    const found = new Map<string, Cookie>();
    for (const header of response.headers.getSetCookie()) {
        const [pair = "", ...rest] = header.split(";").map((part) => part.trim());
        const at = pair.indexOf("=");
        const attributes = new Map<string, string>();
        for (const part of rest) {
            const [name = "", value = ""] = part.split("=");
            attributes.set(name.toLowerCase(), value);
        }
        found.set(pair.slice(0, at), { value: pair.slice(at + 1), attributes });
    }
    return found;
}

function browser(handler: (request: Request) => Promise<Response>) {
    const jar = new Map<string, string>();
    return {
        jar,
        async ask(url: string, method = "GET") {
            const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
            const response = await handler(
                new Request(url, { method, headers: cookie ? { cookie } : {} }),
            );
            for (const [name, { value, attributes }] of cookiesOf(response)) {
                if (attributes.get("max-age") === "0") jar.delete(name);
                else jar.set(name, value);
            }
            return response;
        },
    };
}

function setUp(answers?: Parameters<typeof github>[0]) {
    const fake = github(answers);
    const handler = routed(signIn(env, { fetch: fake.fetch }));
    return { ...fake, handler, ...browser(handler) };
}

async function signedIn(answers?: Parameters<typeof github>[0]) {
    const at = setUp(answers);
    const going = await at.ask(`${BASE}/sign-in?return=${encodeURIComponent("/docs?tab=dark")}`);
    const state = new URL(going.headers.get("location") ?? "").searchParams.get("state");
    const back = await at.ask(`${BASE}/callback?code=the-code&state=${state}`);
    return { ...at, back };
}

describe("signing in", () => {
    it("sends the person to GitHub's own page, to come back to this site", async () => {
        const { ask } = setUp();
        const response = await ask(`${BASE}/sign-in?return=%2Fdocs`);
        expect(response.status).toBe(302);
        const to = new URL(response.headers.get("location") ?? "");
        expect(`${to.origin}${to.pathname}`).toBe("https://github.com/login/oauth/authorize");
        expect(to.searchParams.get("client_id")).toBe("Iv1.client");
        expect(to.searchParams.get("redirect_uri")).toBe(`${BASE}/callback`);
        expect(to.searchParams.get("state")).toMatch(/^[\w-]{20,}$/);
    });

    it("keeps the state in a short-lived cookie the page can't read, for the function only", async () => {
        const { handler } = setUp();
        const response = await handler(new Request(`${BASE}/sign-in?return=%2Fdocs`));
        const state = cookiesOf(response).get(STUDIO_COOKIES.state);
        expect(state?.attributes.has("httponly")).toBe(true);
        expect(state?.attributes.get("path")).toBe(STUDIO_SIGN_IN_BASE);
        expect(Number(state?.attributes.get("max-age"))).toBeLessThanOrEqual(600);
        expect(state?.attributes.get("samesite")).toBe("Lax");
        expect(state?.attributes.has("secure")).toBe(true);
    });

    it("works out its own address from where it is called", async () => {
        const { ask } = setUp();
        const response = await ask(`${SITE}/auth/studio/sign-in?return=%2F`);
        const to = new URL(response.headers.get("location") ?? "");
        expect(to.searchParams.get("redirect_uri")).toBe(`${SITE}/auth/studio/callback`);
    });
});

describe("coming back from GitHub", () => {
    it("swaps the code for a key with the app's secret, and goes back to the page it came from", async () => {
        const { back, asked } = await signedIn();
        expect(back.status).toBe(302);
        expect(back.headers.get("location")).toBe(`${SITE}/docs?tab=dark`);
        expect(asked[0]).toMatchObject({
            method: "POST",
            url: "https://github.com/login/oauth/access_token",
            body: {
                client_id: "Iv1.client",
                client_secret: "client-secret",
                code: "the-code",
                redirect_uri: `${BASE}/callback`,
            },
        });
    });

    it("keeps the key sealed where the page can't read it, for the function only, as long as GitHub says it lasts", async () => {
        const { back } = await signedIn();
        const key = cookiesOf(back).get(STUDIO_COOKIES.key);
        expect(key?.value).not.toContain("ghu_key1");
        expect(key?.attributes.has("httponly")).toBe(true);
        expect(key?.attributes.get("path")).toBe(STUDIO_SIGN_IN_BASE);
        expect(key?.attributes.get("max-age")).toBe("28800");
    });

    it("leaves who signed in where the page can read it, for as long as the sign-in lasts", async () => {
        const { back, asked } = await signedIn();
        const login = cookiesOf(back).get(STUDIO_COOKIES.login);
        expect(login?.value).toBe("mark");
        expect(login?.attributes.get("max-age")).toBe("15897600");
        expect(asked[1]).toMatchObject({
            url: "https://api.github.com/user",
            authorization: "Bearer ghu_key1",
        });
    });

    it("keeps the refresh token encrypted, where the page can't read it, for the function only", async () => {
        const { back } = await signedIn();
        const refresh = cookiesOf(back).get(STUDIO_COOKIES.refresh);
        expect(refresh?.value).not.toContain("ghr_refresh1");
        expect(refresh?.attributes.has("httponly")).toBe(true);
        expect(refresh?.attributes.get("path")).toBe(STUDIO_SIGN_IN_BASE);
        expect(refresh?.attributes.get("max-age")).toBe("15897600");
    });

    it("clears the state once it has been used", async () => {
        const { back } = await signedIn();
        expect(cookiesOf(back).get(STUDIO_COOKIES.state)?.attributes.get("max-age")).toBe("0");
    });

    it("keeps a key GitHub says never runs out for as long as a sign-in lasts", async () => {
        const { back } = await signedIn({ expiring: false });
        expect(cookiesOf(back).get(STUDIO_COOKIES.key)?.attributes.get("max-age")).toBe("15897600");
        expect(cookiesOf(back).has(STUDIO_COOKIES.refresh)).toBe(false);
    });

    it("goes back signed out when the state doesn't match", async () => {
        const { ask, asked } = setUp();
        await ask(`${BASE}/sign-in?return=%2Fdocs`);
        const back = await ask(`${BASE}/callback?code=the-code&state=someone-elses`);
        expect(back.headers.get("location")).toBe(`${SITE}/docs`);
        expect(cookiesOf(back).has(STUDIO_COOKIES.key)).toBe(false);
        expect(asked).toStrictEqual([]);
    });

    it("goes back to the site's front page when there is no state at all", async () => {
        const { ask } = setUp();
        const back = await ask(`${BASE}/callback?code=the-code&state=anything`);
        expect(back.headers.get("location")).toBe(`${SITE}/`);
        expect(cookiesOf(back).has(STUDIO_COOKIES.key)).toBe(false);
    });

    it("goes back signed out when the person said no on GitHub", async () => {
        const { ask } = setUp();
        const going = await ask(`${BASE}/sign-in?return=%2Fdocs`);
        const state = new URL(going.headers.get("location") ?? "").searchParams.get("state");
        const back = await ask(`${BASE}/callback?error=access_denied&state=${state}`);
        expect(back.headers.get("location")).toBe(`${SITE}/docs`);
        expect(cookiesOf(back).has(STUDIO_COOKIES.key)).toBe(false);
    });

    it("goes back signed out when GitHub won't say who the person is", async () => {
        const at = setUp();
        const fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
            new Request(input, init).url === "https://api.github.com/user"
                ? new Response("{}", { status: 401 })
                : at.fetch(input, init);
        const { ask } = browser(routed(signIn(env, { fetch })));
        const going = await ask(`${BASE}/sign-in?return=%2Fdocs`);
        const state = new URL(going.headers.get("location") ?? "").searchParams.get("state");
        const back = await ask(`${BASE}/callback?code=the-code&state=${state}`);
        expect(back.headers.get("location")).toBe(`${SITE}/docs`);
        expect(cookiesOf(back).has(STUDIO_COOKIES.key)).toBe(false);
    });

    it("goes back signed out when GitHub won't swap the code", async () => {
        const { back } = await signedIn({ swaps: false });
        expect(back.headers.get("location")).toBe(`${SITE}/docs?tab=dark`);
        expect(cookiesOf(back).has(STUDIO_COOKIES.key)).toBe(false);
    });
});

describe("the page to come back to", () => {
    it("keeps the path, its query and its fragment on this site", async () => {
        const { ask } = setUp();
        const given = "/docs/colours?tab=dark#brand";
        const going = await ask(`${BASE}/sign-in?return=${encodeURIComponent(given)}`);
        const state = new URL(going.headers.get("location") ?? "").searchParams.get("state");
        const back = await ask(`${BASE}/callback?error=access_denied&state=${state}`);
        expect(back.headers.get("location")).toBe(`${SITE}${given}`);
    });

    it.for([
        ["https://evil.example/", "an address on another site"],
        ["//evil.example/", "an address on another site without its scheme"],
        ["/\\evil.example/", "a backslash browsers read as another site"],
        ["/\t/evil.example/", "a tab browsers drop, leaving another site"],
        ["//evil.example/steal", "another site's page, which isn't a page here"],
        ["/\n/evil.example/", "a newline browsers drop, leaving another site"],
        ["docs", "a path that doesn't start at the site's root"],
        ["", "nothing"],
    ])("is the site's front page when given %s (%s)", async ([given]) => {
        const { ask } = setUp();
        const going = await ask(`${BASE}/sign-in?return=${encodeURIComponent(given ?? "")}`);
        const state = new URL(going.headers.get("location") ?? "").searchParams.get("state");
        const back = await ask(`${BASE}/callback?error=access_denied&state=${state}`);
        expect(back.headers.get("location")).toBe(`${SITE}/`);
    });
});

describe("the key for the page", () => {
    it("is handed to the page from its sealed cookie, never to be stored", async () => {
        const { ask, asked } = await signedIn();
        const before = asked.length;
        const response = await ask(`${BASE}/key`, "POST");
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toStrictEqual({ key: "ghu_key1" });
        expect(asked).toHaveLength(before);
    });

    it("is a new one when the old has run out but the sign-in hasn't", async () => {
        const { ask, jar } = await signedIn();
        jar.delete(STUDIO_COOKIES.key);
        const response = await ask(`${BASE}/key`, "POST");
        expect(response.status).toBe(200);
        expect(await response.json()).toStrictEqual({ key: "ghu_key2" });
        expect(jar.has(STUDIO_COOKIES.key)).toBe(true);
    });

    it("can't be had by someone who isn't signed in, and clears what the page reads", async () => {
        const { ask } = setUp();
        const response = await ask(`${BASE}/key`, "POST");
        expect(response.status).toBe(401);
        expect(cookiesOf(response).get(STUDIO_COOKIES.login)?.attributes.get("max-age")).toBe("0");
    });

    it("isn't a cookie the page could read", async () => {
        const { back } = await signedIn();
        const readable = [...cookiesOf(back)].filter(
            ([, { value, attributes }]) => value && !attributes.has("httponly"),
        );
        expect(readable.map(([name]) => name)).toStrictEqual([STUDIO_COOKIES.login]);
    });
});

describe("a new key", () => {
    it("is swapped for the refresh token, which is sent to GitHub as it was given", async () => {
        const { ask, asked } = await signedIn();
        const response = await ask(`${BASE}/refresh`, "POST");
        expect(response.status).toBe(200);
        expect(asked.at(-2)).toMatchObject({
            url: "https://github.com/login/oauth/access_token",
            body: {
                client_id: "Iv1.client",
                client_secret: "client-secret",
                grant_type: "refresh_token",
                refresh_token: "ghr_refresh1",
            },
        });
        expect(await response.json()).toStrictEqual({ key: "ghu_key2" });
        expect(cookiesOf(response).get(STUDIO_COOKIES.key)?.value).toBeTruthy();
        expect(cookiesOf(response).get(STUDIO_COOKIES.refresh)?.value).toBeTruthy();
    });

    it("asks GitHub again who the person is, so the sign-in lasts as long as the new refresh token", async () => {
        const { ask, jar, asked } = await signedIn();
        jar.delete(STUDIO_COOKIES.login);
        const response = await ask(`${BASE}/refresh`, "POST");
        expect(response.status).toBe(200);
        expect(asked.at(-1)).toMatchObject({
            url: "https://api.github.com/user",
            authorization: "Bearer ghu_key2",
        });
        expect(cookiesOf(response).get(STUDIO_COOKIES.login)).toMatchObject({ value: "mark" });
    });

    it("can't be had without a refresh token, and clears what the page reads", async () => {
        const { ask } = setUp();
        const response = await ask(`${BASE}/refresh`, "POST");
        expect(response.status).toBe(401);
        const cleared = cookiesOf(response);
        expect(cleared.get(STUDIO_COOKIES.key)?.attributes.get("max-age")).toBe("0");
        expect(cleared.get(STUDIO_COOKIES.login)?.attributes.get("max-age")).toBe("0");
    });

    it("leaves the newest sign-in alone when another tab used the same refresh token first", async () => {
        const { ask, jar, handler } = await signedIn();
        const before = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
        await ask(`${BASE}/refresh`, "POST");
        const late = await handler(
            new Request(`${BASE}/refresh`, { method: "POST", headers: { cookie: before } }),
        );
        expect(late.status).toBe(401);
        expect(late.headers.getSetCookie()).toStrictEqual([]);
    });

    it("can't be had when GitHub refuses the refresh token", async () => {
        const { ask } = await signedIn({ refreshes: false });
        expect((await ask(`${BASE}/refresh`, "POST")).status).toBe(401);
    });

    it("can't be had from a refresh token another site's secret encrypted", async () => {
        const first = await signedIn();
        const other = routed(
            signIn(
                {
                    ...env,
                    [STUDIO_SETTINGS.secret]: "another site's secret, long enough to be accepted",
                },
                { fetch: first.fetch },
            ),
        );
        const cookie = [...first.jar].map(([name, value]) => `${name}=${value}`).join("; ");
        const response = await other(
            new Request(`${BASE}/refresh`, { method: "POST", headers: { cookie } }),
        );
        expect(response.status).toBe(401);
    });
});

describe("signing out", () => {
    it("revokes the key at GitHub with the app's own credentials, and clears every cookie where it was set", async () => {
        const { ask, asked, back } = await signedIn();
        const response = await ask(`${BASE}/sign-out`, "POST");
        expect(response.status).toBe(204);
        expect(asked.at(-1)).toMatchObject({
            method: "DELETE",
            url: "https://api.github.com/applications/Iv1.client/token",
            body: { access_token: "ghu_key1" },
            authorization: `Basic ${btoa("Iv1.client:client-secret")}`,
        });
        const cleared = cookiesOf(response);
        const set = cookiesOf(back);
        for (const name of [STUDIO_COOKIES.key, STUDIO_COOKIES.login, STUDIO_COOKIES.refresh]) {
            expect(cleared.get(name)?.attributes.get("max-age")).toBe("0");
            expect(cleared.get(name)?.attributes.get("path")).toBe(
                set.get(name)?.attributes.get("path"),
            );
        }
    });

    it("clears the cookies even with no key to revoke", async () => {
        const { ask, asked } = setUp();
        const response = await ask(`${BASE}/sign-out`, "POST");
        expect(response.status).toBe(204);
        expect(asked).toStrictEqual([]);
    });
});

describe("what another site can't do", () => {
    it("can't post to the function: no new key, no signing out, nothing cleared", async () => {
        const { handler, jar } = await signedIn();
        const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
        for (const address of ["key", "refresh", "sign-out"]) {
            const response = await handler(
                new Request(`${BASE}/${address}`, {
                    method: "POST",
                    headers: { cookie, origin: "https://evil.example" },
                }),
            );
            expect(response.status).toBe(403);
            expect(response.headers.getSetCookie()).toStrictEqual([]);
        }
    });

    it("can't post from a page another site opened, by the browser's own account of it", async () => {
        const { handler } = setUp();
        const response = await handler(
            new Request(`${BASE}/sign-out`, {
                method: "POST",
                headers: { "sec-fetch-site": "cross-site" },
            }),
        );
        expect(response.status).toBe(403);
    });

    it("can't use one sealed cookie in another's place", async () => {
        const at = setUp();
        const going = await at.handler(new Request(`${BASE}/sign-in?return=%2F`));
        const state = going.headers
            .getSetCookie()
            .find((header) => header.startsWith(`${STUDIO_COOKIES.state}=`))
            ?.split(";")[0]
            ?.split("=")[1];
        const response = await at.handler(
            new Request(`${BASE}/refresh`, {
                method: "POST",
                headers: { cookie: `${STUDIO_COOKIES.refresh}=${state}` },
            }),
        );
        expect(response.status).toBe(401);
        expect(at.asked).toStrictEqual([]);
    });
});

describe("the function itself", () => {
    it("hands back a GET and a POST for the host's route file", async () => {
        const { GET, POST } = signIn(env, { fetch: github().fetch });
        expect((await GET(new Request(`${BASE}/sign-in?return=%2F`))).status).toBe(302);
        expect((await POST(new Request(`${BASE}/sign-out`, { method: "POST" }))).status).toBe(204);
    });

    it("answers only its own addresses, each with its own method", async () => {
        const { ask } = setUp();
        expect((await ask(`${BASE}/elsewhere`)).status).toBe(404);
        expect((await ask(`${BASE}/refresh`)).status).toBe(405);
        expect((await ask(`${BASE}/sign-in`, "POST")).status).toBe(405);
    });

    it("leaves Secure off on a site served without https, as on a developer's computer", async () => {
        const { handler } = setUp();
        const response = await handler(
            new Request("http://127.0.0.1:4321/api/sugarcube-studio/sign-in?return=%2F"),
        );
        expect(cookiesOf(response).get(STUDIO_COOKIES.state)?.attributes.has("secure")).toBe(false);
    });

    it("refuses an encryption secret too short to be safe", async () => {
        const handler = routed(signIn({ ...env, [STUDIO_SETTINGS.secret]: "short" }));
        const response = await handler(new Request(`${BASE}/sign-in?return=%2F`));
        expect(response.status).toBe(500);
        expect(await response.text()).toContain(STUDIO_SETTINGS.secret);
    });

    it("names the setting that is missing", async () => {
        const handler = routed(signIn({ ...env, [STUDIO_SETTINGS.clientSecret]: undefined }));
        const response = await handler(new Request(`${BASE}/sign-in?return=%2F`));
        expect(response.status).toBe(500);
        expect(await response.text()).toContain(STUDIO_SETTINGS.clientSecret);
    });
});
