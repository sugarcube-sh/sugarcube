import type { SaveBundle, SaveResult } from "./types";

const SAVE_TIMEOUT_MS = 30_000;

/**
 * The save path when there is no server: the edits go to a service that
 * replays them against the repo and opens a pull request. It responds with that
 * pull request, so the change bar can link to it.
 */
export async function saveOverHttp(
    url: string,
    bundle: SaveBundle,
    timeoutMs = SAVE_TIMEOUT_MS,
): Promise<SaveResult> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bundle),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        const timedOut = err instanceof DOMException && err.name === "TimeoutError";
        return {
            kind: "failed",
            error: timedOut
                ? "The save service did not answer in time."
                : err instanceof Error
                  ? err.message
                  : String(err),
        };
    }

    const body = (await response.json().catch(() => ({}))) as {
        number?: number;
        url?: string;
        error?: string;
        detail?: string;
    };

    if (!response.ok) {
        const reason = [body.error, body.detail].filter(Boolean).join(": ");
        return { kind: "failed", error: reason || `Save failed (${response.status})` };
    }
    if (typeof body.number !== "number" || typeof body.url !== "string") {
        return { kind: "failed", error: "The save service answered without a pull request." };
    }
    return { kind: "pr-submitted", number: body.number, url: body.url };
}
