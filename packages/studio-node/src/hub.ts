import { type Server, createServer } from "node:http";
import { DEVFRAMES_HUB_BASE, initHub } from "@devframes/hub/initiate";
import { clientPath } from "@sugarcube-sh/studio/client";
import {
    STUDIO_SURFACE,
    type StudioTokenSource,
    createNodeTokenSource,
    studioDevframe,
} from "@sugarcube-sh/studio/server";
import { getPort } from "devframe/utils/get-port";
import { open as openInBrowser } from "devframe/utils/open";
import { isAllowedOrigin } from "devframe/utils/origin";
import { HUB_NAME, hubUi, studioDock } from "./studio-hub";

export const STUDIO_PORT = 2823;

const HOST = "localhost";

export type ServeStudioHubOptions = {
    source?: StudioTokenSource;
    port?: number;
    open?: boolean;
};

export type StudioHubServer = {
    origin: string;
    port: number;
    /** Where studio opens on its own, full width. */
    studioUrl: string;
    /** A page loads this with `<script type="module">` to get the dock. */
    embedScriptUrl: string;
    server: Server;
    close: () => Promise<void>;
};

/**
 * Serves studio from a port of its own, so a project not running Vite can still
 * put the dock on its pages: the page loads `embedded.js` from here. Only a hub
 * serves that file, which is why studio runs as one rather than as devframe's
 * simpler single-devframe server. The Vite adapter mounts the same thing.
 */
export async function serveStudioHub(
    options: ServeStudioHubOptions = {},
): Promise<StudioHubServer> {
    const { source = createNodeTokenSource(), open = false } = options;
    const port = options.port ?? (await getPort({ port: STUDIO_PORT, host: HOST }));

    const hub = initHub({
        base: DEVFRAMES_HUB_BASE,
        name: HUB_NAME,
        devframes: [studioDock(studioDevframe({ source, clientAssets: clientPath }))],
        ui: hubUi(),
        auth: false,
    });

    // The page sits on a different port, so everything it fetches from here —
    // embedded.js, then __connection.json — is cross-origin. Under Vite this
    // never comes up, because there studio shares the page's origin. Say yes to
    // any localhost origin, since that is where a page can be coming from.
    const server = createServer((req, res) => {
        const origin = req.headers.origin;
        if (origin && isAllowedOrigin(origin, [])) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
        }
        hub.nodeMiddleware(req, res, () => {
            res.statusCode = 404;
            res.end();
        });
    });
    const detach = hub.attach(server);

    try {
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, HOST, () => {
                server.off("error", reject);
                resolve();
            });
        });
    } catch (error) {
        detach();
        await hub.close();
        throw error;
    }
    await hub.ready;

    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    const origin = `http://${HOST}:${boundPort}`;

    // The dock's iframe URL and page script come out starting with a slash,
    // which a page on another port would resolve against its own server. Put
    // this origin in front of both so they point back here.
    const ctx = await hub.context;
    const dock = ctx.docks.values().find((entry) => entry.id === STUDIO_SURFACE.id);
    let studioPath = `${hub.base}${STUDIO_SURFACE.id}/`;
    if (dock && dock.type === "iframe" && dock.url.startsWith("/")) {
        studioPath = dock.url;
        const { clientScript } = dock;
        ctx.docks.update({
            ...dock,
            url: `${origin}${dock.url}`,
            ...(clientScript
                ? {
                      clientScript: {
                          ...clientScript,
                          importFrom: `${origin}${clientScript.importFrom}`,
                      },
                  }
                : {}),
        });
    }

    const studioUrl = `${origin}${studioPath}`;
    if (open) {
        try {
            await openInBrowser(studioUrl);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(
                `[studio] Could not open a browser (${reason}). Open ${studioUrl} yourself.`,
            );
        }
    }

    return {
        origin,
        port: boundPort,
        studioUrl,
        embedScriptUrl: `${origin}${hub.base}embedded.js`,
        server,
        close: async () => {
            detach();
            await hub.close();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}
