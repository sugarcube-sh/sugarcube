import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { type Logger, type ViteDevServer, build, createServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import sugarcube, { SUGARCUBE_API_PLUGIN_NAME, type SugarcubePluginContext } from "../src/index.js";

const color = (hex: string) => ({ $type: "color", $value: hex });

interface Served {
    server: ViteDevServer;
    context: SugarcubePluginContext;
    logged: string[];
    overlays: string[];
    css: (classes: string) => Promise<string>;
}

const cwd = process.cwd();
let folder: string;
let served: Served | undefined;

afterEach(async () => {
    await served?.server.close();
    served = undefined;
    process.chdir(cwd);
    await rm(folder, { recursive: true, force: true });
});

async function project(): Promise<void> {
    folder = await mkdtemp(join(tmpdir(), "sugarcube-vite-"));
    await mkdir(join(folder, "tokens"));
    await tokens({ color: { ink: color("#111111") } });
    await writeFile(
        join(folder, "tokens/tokens.resolver.json"),
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources: [{ $ref: "base.json" }] }],
        }),
    );
    await config("");
    await writeFile(
        join(folder, "index.html"),
        `<script type="module">import "virtual:sugarcube.css";</script><p class="text-ink">hi</p>`,
    );
    process.chdir(folder);
}

function save(file: string, text: string): Promise<void> {
    return writeFile(join(folder, file), text);
}

function tokens(json: unknown) {
    return save("tokens/base.json", JSON.stringify(json, null, 2));
}

function config(variablesExtra: string) {
    return save(
        "sugarcube.config.ts",
        `export default {
    resolver: "tokens/tokens.resolver.json",
    variables: { path: "tokens.css"${variablesExtra} },
    utilities: { classes: { color: { source: "color.*", prefix: "text" } } },
};
`,
    );
}

function capturing(logged: string[]): Logger {
    const log = (message: string) => {
        logged.push(stripVTControlCharacters(message));
    };
    return {
        info: log,
        warn: log,
        warnOnce: log,
        error: log,
        clearScreen: () => {},
        hasErrorLogged: () => false,
        hasWarned: false,
    };
}

async function serve(): Promise<Served> {
    const logged: string[] = [];
    const overlays: string[] = [];
    const plugins = (await sugarcube()) as Array<{ name: string; api?: any }>;
    let watching: Promise<void> = Promise.resolve();
    const ready = {
        name: "test:watcher-ready",
        configureServer(dev: ViteDevServer) {
            watching = new Promise((resolve) => dev.watcher.once("ready", () => resolve()));
        },
    };
    const server = await createServer({
        root: folder,
        configFile: false,
        customLogger: capturing(logged),
        plugins: [ready, ...plugins],
        server: { port: 0 },
    });
    await watching;
    const send = server.ws.send.bind(server.ws) as (payload: any) => void;
    server.ws.send = ((payload: any) => {
        if (payload?.type === "error") overlays.push(payload.err.message);
        send(payload);
    }) as typeof server.ws.send;
    const context = plugins.find((p) => p.name === SUGARCUBE_API_PLUGIN_NAME)?.api.getContext();
    const uno = plugins.find((p) => p.name === "unocss:api")?.api.getContext();
    const css = async (classes: string) => (await uno.uno.generate(classes)).css as string;
    served = { server, context, logged, overlays, css };
    return served;
}

function reloaded(context: SugarcubePluginContext): Promise<void> {
    return new Promise((resolve) => {
        const stop = context.onReload(() => {
            stop();
            resolve();
        });
    });
}

async function until(done: () => boolean, what: string): Promise<void> {
    const started = Date.now();
    while (!done()) {
        if (Date.now() - started > 5_000) throw new Error(`Waited for ${what}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

describe("sugarcube's Vite plugin", () => {
    it("serves the tokens' variables and the classes markup uses", async () => {
        await project();
        const { css } = await serve();

        const written = await css("text-ink");

        expect(written).toContain("--color-ink: #111111");
        expect(written).toContain(".text-ink{color:var(--color-ink);}");
    });

    it("serves the new value when a token is saved", async () => {
        await project();
        const { context, css } = await serve();

        const reload = reloaded(context);
        await tokens({ color: { ink: color("#222222") } });
        await reload;

        expect(await css("text-ink")).toContain("--color-ink: #222222");
    });

    it("makes a new token's class while running", async () => {
        await project();
        const { context, css } = await serve();
        expect(await css("text-paper")).not.toContain(".text-paper");

        const reload = reloaded(context);
        await tokens({ color: { ink: color("#111111"), paper: color("#ffffff") } });
        await reload;

        expect(await css("text-paper")).toContain(".text-paper{color:var(--color-paper);}");
    });

    it("keeps the last CSS when a save has errors, and prints them in the terminal, with no overlay", async () => {
        await project();
        const { context, css, logged, overlays } = await serve();

        const reload = reloaded(context);
        await tokens({ color: { ink: color("#111111"), text: color("{color.inc}") } });
        await reload;

        expect(await css("text-ink")).toContain("--color-ink: #111111");
        expect(await css("text-text")).not.toContain(".text-text");
        expect(logged.join("\n")).toContain(
            "tokens/base.json:9:17  error  `color.inc` does not exist; did you mean `color.ink`?",
        );
        expect(logged.join("\n")).toMatch(/\n1 error\.$/m);
        expect(overlays).toEqual([]);
    });

    it("serves the CSS again once the errors are fixed", async () => {
        await project();
        const { context, css } = await serve();
        let reload = reloaded(context);
        await tokens({ color: { ink: color("{color.inc}") } });
        await reload;

        reload = reloaded(context);
        await tokens({ color: { ink: color("#333333") } });
        await reload;

        expect(context.problems).toEqual([]);
        expect(await css("text-ink")).toContain("--color-ink: #333333");
    });

    it("sends no overlay to a page that opens while there are errors", async () => {
        await project();
        await tokens({ color: { ink: color("{color.inc}") } });
        const { server } = await serve();
        await server.listen();
        const address = server.httpServer?.address();
        const port = typeof address === "object" ? address?.port : undefined;

        const received: Array<{ type: string; err?: { message: string } }> = [];
        const socket = new WebSocket(
            `ws://localhost:${port}/?token=${server.config.webSocketToken}`,
            "vite-hmr",
        );
        socket.addEventListener("message", (event) =>
            received.push(JSON.parse(String(event.data))),
        );
        try {
            await until(() => received.some(({ type }) => type === "connected"), "the page");
            await new Promise((resolve) => setTimeout(resolve, 200));
        } finally {
            socket.close();
        }

        expect(received.filter(({ type }) => type === "error")).toEqual([]);
    });

    it("reads the config again when it is saved", async () => {
        await project();
        const { context, css } = await serve();

        const reload = reloaded(context);
        await config(`, prefix: "ds"`);
        await reload;

        expect(await css("text-ink")).toContain(".text-ink{color:var(--ds-color-ink);}");
    });

    it("shows a config that cannot be loaded until it loads, serving the last CSS", async () => {
        await project();
        const { context, css, logged, overlays } = await serve();

        const configProblems = () => logged.filter((text) => text.includes("invalid-config"));
        await save("sugarcube.config.ts", "export default { variables: ;");
        await until(() => configProblems().length > 0, "the config's problem");

        expect(logged.join("\n")).toMatch(/^sugarcube\.config\.ts {2}error {2}/m);

        let reload = reloaded(context);
        await tokens({ color: { ink: color("#777777") } });
        await reload;
        expect(configProblems()).toHaveLength(2);
        expect(await css("text-ink")).toContain("--color-ink: #111111");
        expect(overlays).toEqual([]);

        reload = reloaded(context);
        await config("");
        await reload;
        expect(context.problems).toEqual([]);
        expect(await css("text-ink")).toContain("--color-ink: #777777");
    });

    it("times each save when DEBUG names sugarcube, and only then", async () => {
        await project();
        const timed = /^\[sugarcube\] read \d+ms {2}css \d+ms {2}total \d+ms {2}\(base\.json\)$/m;
        const cases: Array<[string | undefined, boolean]> = [
            ["sugarcube", true],
            ["*", true],
            ["vite:*,sugarcube", true],
            ["true", false],
            ["vite:*", false],
            [undefined, false],
        ];
        const seen: Array<[string | undefined, boolean]> = [];
        try {
            for (const [debug, expected] of cases) {
                if (debug === undefined) delete process.env.DEBUG;
                else process.env.DEBUG = debug;
                const { context, logged } = await serve();
                const reload = reloaded(context);
                await tokens({ color: { ink: color(expected ? "#444444" : "#555555") } });
                await reload;
                seen.push([debug, timed.test(logged.join("\n"))]);
                await served?.server.close();
                served = undefined;
            }
        } finally {
            delete process.env.DEBUG;
        }

        expect(seen).toEqual(cases);
    });

    it("logs an error it did not expect, rather than leave it unhandled", async () => {
        await project();
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", onUnhandled);
        try {
            const { context, logged } = await serve();
            context.onReload(() => {
                throw new Error("a listener broke");
            });

            await tokens({ color: { ink: color("#666666") } });
            await until(() => logged.includes("[sugarcube] a listener broke"), "the error");
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(unhandled).toEqual([]);
        } finally {
            process.off("unhandledRejection", onUnhandled);
        }
    });

    it("reads a config save whose last write landed while Vite's watcher was dropping changes", async () => {
        await project();
        const { server, context } = await serve();
        const path = join(folder, "sugarcube.config.ts");
        const finished = `export default {
    resolver: "tokens/tokens.resolver.json",
    variables: { path: "tokens.css", prefix: "ds" },
    utilities: { classes: { color: { source: "color.*", prefix: "text" } } },
};
`;
        let reported = false;
        server.watcher.on("change", (file) => {
            if (reported || !file.endsWith("sugarcube.config.ts")) return;
            reported = true;
            writeFileSync(path, finished);
        });

        await until(() => {
            if (!reported) writeFileSync(path, "");
            return reported;
        }, "Vite watching the config");
        await until(() => context.config.variables.prefix === "ds", "the save's last write");

        expect(context.problems).toEqual([]);
    });

    it("reads two quick config saves one at a time, the newer winning", async () => {
        await project();
        const { context, css } = await serve();

        await save(
            "sugarcube.config.ts",
            `await new Promise((resolve) => setTimeout(resolve, 400));
export default {
    resolver: "tokens/tokens.resolver.json",
    variables: { path: "tokens.css", prefix: "old" },
    utilities: { classes: { color: { source: "color.*", prefix: "text" } } },
};
`,
        );
        await new Promise((resolve) => setTimeout(resolve, 150));
        await config(`, prefix: "new"`);
        await until(() => context.config.variables.prefix === "new", "the newer config");
        await new Promise((resolve) => setTimeout(resolve, 600));

        expect(context.config.variables.prefix).toBe("new");
        expect(await css("text-ink")).toContain(".text-ink{color:var(--new-color-ink);}");
    });

    it("hands the config, the Document and its problems to other plugins", async () => {
        await project();
        const { context } = await serve();

        expect(context.config.resolver).toContain("tokens.resolver.json");
        expect(context.doc.files).toEqual(["tokens.resolver.json", "base.json"]);
        expect(context.problems).toEqual([]);
    });
});

describe("vite build", () => {
    it("fails with the problems listed when the tokens have errors", async () => {
        await project();
        await tokens({ color: { ink: color("{color.inc}") } });
        const plugins = await sugarcube();

        const built = build({
            root: folder,
            configFile: false,
            logLevel: "silent",
            plugins,
            build: { write: false },
        });

        await expect(built).rejects.toThrow("`color.inc` does not exist");
    });

    it("lists warnings, and builds", async () => {
        await project();
        await writeFile(
            join(folder, "sugarcube.config.ts"),
            `export default {
    resolver: "tokens/tokens.resolver.json",
    utilities: { classes: { color: { source: "color.*", prefix: "text" }, padding: { source: "space.*", prefix: "p" } } },
};
`,
        );
        const logged: string[] = [];
        const plugins = await sugarcube();

        await build({
            root: folder,
            configFile: false,
            customLogger: capturing(logged),
            plugins,
            build: { write: false },
        });

        expect(logged.join("\n")).toContain("`padding` makes no classes");
    });
});
