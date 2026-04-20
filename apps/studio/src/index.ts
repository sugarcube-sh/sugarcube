import type { Env } from "./env";
import { type PRRequest, createPR } from "./github";

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
    let body: PRRequest;
    try {
        body = (await request.json()) as PRRequest;
    } catch {
        return json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.title || !Array.isArray(body.files) || body.files.length === 0) {
        return json({ error: "Missing required fields: title, files" }, 400);
    }

    for (const file of body.files) {
        if (!file.path || !Array.isArray(file.edits) || file.edits.length === 0) {
            return json({ error: "Each file must have a path and at least one edit" }, 400);
        }
    }

    try {
        const result = await createPR(env, body);
        return json(result, 201);
    } catch (err) {
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
