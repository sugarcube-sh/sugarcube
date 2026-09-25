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
    /** Where Studio opens full width. */
    studioUrl: string;
    /** The one tag a page adds to get the dock: `<script type="module" src=...>`. */
    embedScriptUrl: string;
    server: Server;
    close: () => Promise<void>;
};

/**
 * Studio as a devframes hub on its own port. A hub, not the single-devframe
 * dev server, because only a hub serves `embedded.js`: the bootstrap a page
 * on any other server loads to get the dock, and through it Studio, over
 * itself. This is the same shape the Vite adapter mounts.
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

    // A page on another local port loads embedded.js as a module and fetches
    // the connection descriptor from here, both CORS requests. devframe's hub
    // expects to share the page's origin (it does under Vite); on its own port
    // it needs to say yes to the loopback origins a page can come from.
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

    // The hub registers the dock's frame and its page script by path. A page
    // on another origin would resolve those against itself, so the entry is
    // re-registered with this server's origin once the port is known. The
    // bootstrap locks its frame messaging to the entry's origin, so this is
    // the one place the origin has to be spelled out.
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
