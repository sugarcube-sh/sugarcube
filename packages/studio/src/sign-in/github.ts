export type GitHubTokens = {
    readonly access_token: string;
    readonly expires_in?: number;
    readonly refresh_token?: string;
    readonly refresh_token_expires_in?: number;
};

export type GitHubApp = { readonly clientID: string; readonly clientSecret: string };

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export function createGitHubSignIn({ clientID, clientSecret }: GitHubApp, fetch: Fetch) {
    return {
        async requestTokens(body: Record<string, string>): Promise<GitHubTokens | undefined> {
            const response = await fetch(GITHUB_TOKEN_URL, {
                method: "POST",
                headers: { "accept": "application/json", "content-type": "application/json" },
                body: JSON.stringify({ client_id: clientID, client_secret: clientSecret, ...body }),
            });
            const responseBody = (await response.json().catch(() => undefined)) as
                | Partial<GitHubTokens>
                | undefined;
            return responseBody?.access_token ? (responseBody as GitHubTokens) : undefined;
        },
        async getLogin(key: string): Promise<string | undefined> {
            const response = await fetch(`${GITHUB_API_URL}/user`, {
                headers: { accept: "application/vnd.github+json", authorization: `Bearer ${key}` },
            });
            const responseBody = (await response.json().catch(() => undefined)) as
                | { login?: string }
                | undefined;
            return responseBody?.login;
        },
        async revoke(key: string): Promise<void> {
            await fetch(`${GITHUB_API_URL}/applications/${clientID}/token`, {
                method: "DELETE",
                headers: {
                    "accept": "application/vnd.github+json",
                    "authorization": `Basic ${btoa(`${clientID}:${clientSecret}`)}`,
                    "content-type": "application/json",
                },
                body: JSON.stringify({ access_token: key }),
            }).catch(() => undefined);
        },
    };
}
