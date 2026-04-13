import { applyEdits, modify } from "jsonc-parser";
import type { Env } from "./env";

const GITHUB_API = "https://api.github.com";

function base64url(data: Uint8Array): string {
    let binary = "";
    for (const byte of data) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlEncodeJSON(obj: Record<string, unknown>): string {
    return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
    // Handle both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats.
    // Also handle literal \n sequences from env vars (wrangler .dev.vars stores PEM keys this way).
    const body = pem
        .replace(/\\n/g, "\n")
        .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
        .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
        .replace(/\s/g, "");

    const binary = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

    return crypto.subtle.importKey(
        "pkcs8",
        binary,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );
}

async function createJWT(clientID: string, privateKeyPem: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = base64urlEncodeJSON({ alg: "RS256", typ: "JWT" });
    const payload = base64urlEncodeJSON({
        iat: now - 60,
        exp: now + 600,
        iss: clientID,
    });

    const signingInput = `${header}.${payload}`;
    const key = await importPrivateKey(privateKeyPem);
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(signingInput)
    );

    return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

async function getInstallationToken(env: Env): Promise<string> {
    const jwt = await createJWT(env.GITHUB_CLIENT_ID, env.GITHUB_APP_PRIVATE_KEY);

    const res = await fetch(
        `${GITHUB_API}/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "sugarcube-studio",
                "X-GitHub-Api-Version": "2026-03-10",
            },
        }
    );

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to get installation token (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { token: string };
    return data.token;
}

function githubHeaders(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "sugarcube-studio",
        "X-GitHub-Api-Version": "2026-03-10",
    };
}

async function githubGet(token: string, path: string): Promise<unknown> {
    const res = await fetch(`${GITHUB_API}${path}`, {
        headers: githubHeaders(token),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub GET ${path} failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function githubPost(token: string, path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${GITHUB_API}${path}`, {
        method: "POST",
        headers: { ...githubHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
}

/** A single token value edit: the path segments to the property and the new value. */
export type TokenEdit = {
    /** JSON path segments, e.g. ["color", "neutral", "surface", "default", "$value"] */
    jsonPath: string[];
    /** The new value to set at that path */
    value: unknown;
};

/** Edits to apply to a single file. */
export type FileEdits = {
    /** File path in the repo, e.g. "registry/tokens/starter-kits/fluid/colors.json" */
    path: string;
    /** The individual token edits to apply to this file */
    edits: TokenEdit[];
};

export type PRRequest = {
    title: string;
    description: string;
    files: FileEdits[];
};

export type PRResult = {
    number: number;
    url: string;
};

// We want the PR to match the target repo's formatting as much as possible
// as a courtesy
function detectIndent(rawJSON: string): string {
    const match = rawJSON.match(/\n(\s+)/);
    return match?.[1] ?? "  ";
}

function applyTokenEdits(rawJSON: string, edits: TokenEdit[]): string {
    const indent = detectIndent(rawJSON);
    const eol = rawJSON.includes("\r\n") ? "\r\n" : "\n";
    let result = rawJSON;
    for (const edit of edits) {
        const textEdits = modify(result, edit.jsonPath, edit.value, {
            formattingOptions: {
                tabSize: indent.length,
                insertSpaces: !indent.startsWith("\t"),
                eol,
            },
        });
        result = applyEdits(result, textEdits);
    }
    return result;
}

export async function createPR(env: Env, request: PRRequest): Promise<PRResult> {
    const token = await getInstallationToken(env);
    const repo = env.GITHUB_REPO;
    const baseBranch = env.GITHUB_BASE_BRANCH;

    const ref = (await githubGet(token, `/repos/${repo}/git/ref/heads/${baseBranch}`)) as {
        object: { sha: string };
    };
    const baseSHA = ref.object.sha;

    const baseCommit = (await githubGet(token, `/repos/${repo}/git/commits/${baseSHA}`)) as {
        tree: { sha: string };
    };
    const baseTreeSHA = baseCommit.tree.sha;

    const treeEntries: { path: string; mode: string; type: string; sha: string }[] = [];

    for (const file of request.files) {
        const existing = (await githubGet(
            token,
            `/repos/${repo}/contents/${file.path}?ref=${baseBranch}`
        )) as { content: string };

        const rawContent = atob(existing.content.replace(/\n/g, ""));

        const updatedContent = applyTokenEdits(rawContent, file.edits);

        const blob = (await githubPost(token, `/repos/${repo}/git/blobs`, {
            content: updatedContent,
            encoding: "utf-8",
        })) as { sha: string };

        treeEntries.push({
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: blob.sha,
        });
    }

    const tree = (await githubPost(token, `/repos/${repo}/git/trees`, {
        base_tree: baseTreeSHA,
        tree: treeEntries,
    })) as { sha: string };

    const commit = (await githubPost(token, `/repos/${repo}/git/commits`, {
        message: request.title,
        tree: tree.sha,
        parents: [baseSHA],
    })) as { sha: string };

    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const branchName = `studio-${stamp}`;
    await githubPost(token, `/repos/${repo}/git/refs`, {
        ref: `refs/heads/${branchName}`,
        sha: commit.sha,
    });

    const pr = (await githubPost(token, `/repos/${repo}/pulls`, {
        title: request.title,
        body: request.description,
        head: branchName,
        base: baseBranch,
    })) as { number: number; html_url: string };

    return { number: pr.number, url: pr.html_url };
}
