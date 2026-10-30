export type Tokens = {
    readonly access_token: string;
    readonly expires_in?: number;
    readonly refresh_token?: string;
    readonly refresh_token_expires_in?: number;
};

export type GitHubApp = { readonly clientId: string; readonly clientSecret: string };

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API = "https://api.github.com";

export function githubSignIn({ clientId, clientSecret }: GitHubApp, fetch: Fetch) {
    return {
        async tokens(body: Record<string, string>): Promise<Tokens | undefined> {
            const response = await fetch(GITHUB_TOKEN, {
                method: "POST",
                headers: { "accept": "application/json", "content-type": "application/json" },
                body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
            });
            const answer = (await response.json().catch(() => undefined)) as
                | Partial<Tokens>
                | undefined;
            return answer?.access_token ? (answer as Tokens) : undefined;
        },
        async login(key: string): Promise<string | undefined> {
            const response = await fetch(`${GITHUB_API}/user`, {
                headers: { accept: "application/vnd.github+json", authorization: `Bearer ${key}` },
            });
            const answer = (await response.json().catch(() => undefined)) as
                | { login?: string }
                | undefined;
            return answer?.login;
        },
        async revoke(key: string): Promise<void> {
            await fetch(`${GITHUB_API}/applications/${clientId}/token`, {
                method: "DELETE",
                headers: {
                    "accept": "application/vnd.github+json",
                    "authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                    "content-type": "application/json",
                },
                body: JSON.stringify({ access_token: key }),
            }).catch(() => undefined);
        },
    };
}
