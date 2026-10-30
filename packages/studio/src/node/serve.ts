import { createServer } from "node:http";
import { initHub } from "@devframes/hub/initiate";
import { getPort } from "devframe/utils/get-port";
import { open as openInBrowser } from "devframe/utils/open";
import { isAllowedOrigin } from "devframe/utils/origin";
import { BUILT_APP } from "../built-files";
import { ErrorMessages } from "../error-messages";
import { studioHub } from "../hub/studio-hub";
import { STUDIO_SURFACE } from "../server/define-studio";
import { studioDevframe } from "../server/definition";
import type { StudioFiles } from "../server/files";
import { STUDIO_DOCK_SCRIPT, STUDIO_ROUTE } from "../studio-names";
import { projectFiles } from "./project-files";

export const STUDIO_PORT = 2823;

const HOST = "localhost";

export type ServeStudioOptions = {
    port?: number;
    open?: boolean;
};

export type StudioServer = {
    origin: string;
    port: number;
    studioUrl: string;
    embedScriptUrl: string;
    close: () => Promise<void>;
};

export async function serveStudio(options: ServeStudioOptions = {}): Promise<StudioServer> {
    return serveFiles(await projectFiles(), options);
}

export async function serveFiles(
    files: StudioFiles,
    options: ServeStudioOptions = {},
): Promise<StudioServer> {
    const { open = false } = options;
    const port = options.port ?? (await getPort({ port: STUDIO_PORT, host: HOST }));

    const hub = initHub({
        ...studioHub(studioDevframe({ files, clientAssets: BUILT_APP })),
        auth: false,
    });

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

    const ctx = await hub.context;
    const dock = ctx.docks.values().find((entry) => entry.id === STUDIO_SURFACE.id);
    if (dock && dock.type === "iframe" && dock.url.startsWith("/")) {
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

    const studioUrl = `${origin}${STUDIO_ROUTE}`;
    if (open) {
        try {
            await openInBrowser(studioUrl);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(ErrorMessages.NO_BROWSER(reason, studioUrl));
        }
    }

    return {
        origin,
        port: boundPort,
        studioUrl,
        embedScriptUrl: `${origin}${STUDIO_DOCK_SCRIPT}`,
        close: async () => {
            detach();
            await hub.close();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        },
    };
}
