import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

const REPO = "owner/demo";
const BASE_SHA = "base000";
const COLOR = `{
  "color": {
    "$type": "color",
    "blue": { "$value": "#00f", "$description": "Café blue" }
  }
}
`;

let env: Env;

beforeAll(async () => {
    const pair = await crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
    );
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----`;
    env = {
        GITHUB_CLIENT_ID: "client",
        GITHUB_INSTALLATION_ID: "1",
        GITHUB_APP_PRIVATE_KEY: pem,
        GITHUB_REPO: REPO,
        GITHUB_BASE_BRANCH: "main",
    };
});

let unexpected: string[] = [];

beforeEach(() => {
    unexpected = [];
});

afterEach(() => {
    vi.unstubAllGlobals();
    expect(unexpected).toEqual([]);
});

const utf8Base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

function github(files: Record<string, { content?: string; encoding?: string }>) {
    const posted: Array<{ path: string; body: unknown }> = [];
    const reads: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        const path = url.replace("https://api.github.com", "");
        if (init?.method === "POST")
            posted.push({ path, body: JSON.parse(String(init.body ?? "{}")) });
        const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
        if (path.endsWith("/access_tokens")) return reply({ token: "t" });
        if (path.endsWith("/git/ref/heads/main")) return reply({ object: { sha: BASE_SHA } });
        if (path.includes("/git/commits/")) return reply({ tree: { sha: "tree000" } });
        if (path.includes("/contents/")) {
            reads.push(path);
            const file = decodeURIComponent(path.split("/contents/")[1]?.split("?")[0] ?? "");
            return reply(files[file] ?? {});
        }
        if (path.endsWith("/git/trees")) return reply({ sha: "tree111" });
        if (path.endsWith("/git/commits")) return reply({ sha: "commit111" });
        if (path.endsWith("/git/refs")) return reply({});
        if (path.endsWith("/pulls"))
            return reply({ number: 7, html_url: "https://github.com/pr/7" });
        return new Response("not stubbed", { status: 500 });
    });
    return { posted, reads };
}

const submit = (body: unknown) =>
    worker.fetch(
        new Request("https://worker.test/submit-pr", {
            method: "POST",
            body: JSON.stringify(body),
        }),
        env,
    );

const edit = (ops: unknown[], path = "tokens/color.json") => ({
    title: "Studio edit",
    description: "",
    files: [{ path, ops }],
});

describe("the door", () => {
    it("refuses a body with no files", async () => {
        expect((await submit({ title: "x", files: [] })).status).toBe(400);
    });

    it("refuses an operation Studio does not record, naming the file", async () => {
        const response = await submit(edit([{ kind: "rename", path: ["color", "blue"] }]));
        expect(response.status).toBe(400);
        expect(((await response.json()) as { error: string }).error).toContain("tokens/color.json");
    });

    it("refuses a set that carries no value", async () => {
        expect(
            (await submit(edit([{ kind: "set", path: ["color", "blue", "$value"] }]))).status,
        ).toBe(400);
    });

    it("knows an add", async () => {
        github({ "tokens/color.json": { content: utf8Base64(COLOR), encoding: "base64" } });
        const response = await submit(
            edit([
                { kind: "add", path: ["color", "red"], value: { $type: "color", $value: "#f00" } },
            ]),
        );
        expect(response.status).toBe(201);
    });
});

describe("a save", () => {
    it("reads at the commit it builds on, replays the operations, and keeps text outside ASCII", async () => {
        const gh = github({
            "tokens/color.json": { content: utf8Base64(COLOR), encoding: "base64" },
        });

        const response = await submit(
            edit([{ kind: "set", path: ["color", "blue", "$value"], value: "#0000ff" }]),
        );

        expect(response.status).toBe(201);
        expect(gh.reads.every((read) => read.endsWith(`?ref=${BASE_SHA}`))).toBe(true);
        const tree = gh.posted.find((post) => post.path.endsWith("/git/trees"))?.body as {
            tree: Array<{ path: string; content: string }>;
        };
        expect(tree.tree).toHaveLength(1);
        const written = JSON.parse(tree.tree[0]?.content ?? "{}");
        expect(written.color.blue.$value).toBe("#0000ff");
        expect(written.color.blue.$description).toBe("Café blue");
    });

    it("folds two entries for one file into one, in order", async () => {
        const gh = github({
            "tokens/color.json": { content: utf8Base64(COLOR), encoding: "base64" },
        });

        await submit({
            title: "Studio edit",
            description: "",
            files: [
                {
                    path: "tokens/color.json",
                    ops: [{ kind: "set", path: ["color", "blue", "$value"], value: "#111" }],
                },
                {
                    path: "tokens/color.json",
                    ops: [{ kind: "set", path: ["color", "blue", "$value"], value: "#222" }],
                },
            ],
        });

        const tree = gh.posted.find((post) => post.path.endsWith("/git/trees"))?.body as {
            tree: Array<{ content: string }>;
        };
        expect(tree.tree).toHaveLength(1);
        expect(JSON.parse(tree.tree[0]?.content ?? "{}").color.blue.$value).toBe("#222");
    });

    it("answers a conflict when the token was deleted on the base, and opens nothing", async () => {
        const gh = github({
            "tokens/color.json": { content: utf8Base64(COLOR), encoding: "base64" },
        });

        const response = await submit(
            edit([{ kind: "set", path: ["color", "brand", "$value"], value: "#f00" }]),
        );

        expect(response.status).toBe(409);
        expect(gh.posted.some((post) => post.path.endsWith("/pulls"))).toBe(false);
    });

    it("refuses a file GitHub will not hand over, rather than replacing it with a stub", async () => {
        github({ "tokens/color.json": { content: "", encoding: "none" } });

        const response = await submit(
            edit([{ kind: "set", path: ["color", "blue", "$value"], value: "#000" }]),
        );

        expect(response.status).toBe(422);
        expect(((await response.json()) as { error: string }).error).toContain("tokens/color.json");
    });
});
