import { createStore } from "zustand/vanilla";
import { connectStudio } from "../providers/rpc-client";
import type { TokenSnapshot } from "../tokens/types";
import { fetchInitData, snapshotFromDisk } from "./connected-init";
import { readOpsStash, writeOpsStash } from "./ops-stash";
import { attachPageChannel } from "./page-channel";
import { saveOverHttp } from "./save-over-http";
import type { Host, SaveBundle, SaveResult } from "./types";

/**
 * Studio as a devframe client, whatever is on the other end. With a live
 * server, a save writes the files there. With a static dump there is no
 * server to write anything, so a save goes over HTTP to the service the
 * build named, which opens a pull request. The button says Save either way.
 */
export async function createConnectedHost(signal: AbortSignal): Promise<Host> {
    const { transport, config, diskState, save: rpcSave } = await connectStudio(signal);

    const initial = await fetchInitData(diskState, signal);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const baseline = createStore<TokenSnapshot>(() => initial);

    const unsubDisk = diskState.on("updated", (next) => {
        const snapshot = snapshotFromDisk(next);
        if (snapshot) baseline.setState(snapshot);
    });
    signal.addEventListener("abort", unsubDisk);

    const project = stashKey(initial);
    const restore = await readOpsStash(project);
    const live = transport !== "static";

    const save = async (bundle: SaveBundle): Promise<SaveResult> => {
        try {
            if (live) {
                await rpcSave(bundle);
                return { kind: "persisted" };
            }
            if (!config.saveUrl) {
                return { kind: "failed", error: "This Studio has nowhere to send a save." };
            }
            return await saveOverHttp(config.saveUrl, bundle);
        } catch (err) {
            return { kind: "failed", error: err instanceof Error ? err.message : String(err) };
        }
    };

    return {
        baseline,
        ...(restore && restore.length > 0 ? { restore } : {}),
        persist: (ops) => {
            writeOpsStash(project, ops).catch(() => {});
        },
        attach: (store) => attachPageChannel(store, baseline),
        save,
        capabilities: {
            saveLabel: "Save",
            discardLabel: "Discard",
            requiresSaveMetadata: !live,
        },
    };
}

/**
 * What identifies the project in the stash: the resolver path, which core
 * fills by discovery when the config names none. A host whose config carries
 * no resolver at all falls back to the first file the first context reads.
 */
function stashKey(snapshot: TokenSnapshot): string {
    return snapshot.config.resolver ?? snapshot.sources.order[0]?.sources[0]?.file ?? "default";
}
