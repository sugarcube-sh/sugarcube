import { WriteOpFailed } from "@sugarcube-sh/studio/write-ops";
import type { Env } from "./env";
import { SaveRefused, createPR } from "./github";
import { checkRequest } from "./request";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method !== "POST") {
            return json({ error: "Method not allowed" }, 405);
        }

        const url = new URL(request.url);

        if (url.pathname === "/submit-pr") {
            return handleSubmitPR(request, env);
        }

        return json({ error: "Not found" }, 404);
    },
} satisfies ExportedHandler<Env>;

async function handleSubmitPR(request: Request, env: Env): Promise<Response> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, 400);
    }

    const checked = checkRequest(body);
    if ("error" in checked) return json({ error: checked.error }, 400);

    try {
        const result = await createPR(env, checked.request);
        return json(result, 201);
    } catch (err) {
        if (err instanceof WriteOpFailed) {
            return json(
                { error: "The repository moved under this save", detail: err.message },
                409,
            );
        }
        if (err instanceof SaveRefused) return json({ error: err.message }, 422);
        console.error("PR creation failed:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Failed to create PR", detail: message }, 500);
    }
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
        },
    });
}
