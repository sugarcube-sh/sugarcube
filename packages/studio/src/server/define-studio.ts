import type { TokenSources } from "@sugarcube-sh/core/client";
import { STUDIO_RPC } from "../protocol";
import type { StudioDiskState } from "../tokens/types";
import type { FileOps, FileWriteOp } from "../tokens/write-ops";
import { diskStateFromSource, hasNamingFunction } from "./disk-state";
import type {
    DefineStudioOptions,
    StudioHostBridge,
    StudioSaveBundle,
    StudioSurface,
    StudioTokenSource,
} from "./types";

export const STUDIO_ROUTE = "/__studio/";

export const STUDIO_SURFACE: StudioSurface = {
    id: "sugarcube-studio",
    title: "Studio",
    route: STUDIO_ROUTE,
};

const nothingToShow = (errors: readonly string[]) =>
    [
        "[studio] The token source produced no config, trees or resolved tokens.",
        "Studio mounts on the next load that succeeds.",
        ...errors,
    ].join(" ");

const NAMING_DROPPED =
    "[studio] The config names variables with a function, which cannot run in the browser. " +
    "The page preview and any variable name Studio shows use the default naming.";

const notLoaded = (path: string) =>
    `[studio] Refusing to write ${path}: it is not one of the token files loaded.`;

export async function defineStudio(
    source: StudioTokenSource,
    host: StudioHostBridge,
    options: DefineStudioOptions = {},
): Promise<void> {
    if (options.saveUrl) host.publishConfig?.({ saveUrl: options.saveUrl });

    await source.ready;

    let warnedNaming = false;
    const publishable = (): StudioDiskState | null => {
        const next = diskStateFromSource(source);
        if (!next) {
            host.warn(nothingToShow(source.errors ?? []));
            return null;
        }
        if (!warnedNaming && hasNamingFunction(source.config)) {
            warnedNaming = true;
            host.warn(NAMING_DROPPED);
        }
        return next;
    };

    const disk = await host.sharedState<Partial<StudioDiskState>>(
        STUDIO_RPC.SHARED_STATE_DISK,
        publishable() ?? {},
    );

    source.onReload(() => {
        const next = publishable();
        if (next) disk.mutate((draft) => Object.assign(draft, next));
    });

    host.registerAction<[StudioSaveBundle]>(STUDIO_RPC.SAVE, async (bundle) => {
        await source.writeOps(admitted(bundle.files, source.sources));
    });
}

function admitted(files: FileOps[], sources: TokenSources | null): FileOps[] {
    const loaded = new Set(Object.keys(sources?.files ?? {}));
    const merged = new Map<string, FileWriteOp[]>();

    for (const file of files) {
        if (!loaded.has(file.path)) throw new Error(notLoaded(file.path));
        const held = merged.get(file.path);
        if (held) held.push(...file.ops);
        else merged.set(file.path, [...file.ops]);
    }

    return Array.from(merged, ([path, ops]) => ({ path, ops }));
}
