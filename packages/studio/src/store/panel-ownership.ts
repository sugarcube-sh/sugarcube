import type { PanelBinding, PanelSection } from "@sugarcube-sh/core/client";
import type { PathIndex } from "../tokens/path-index";

type WriterKind = "declarative" | "imperative";

type PanelWriter = {
    id: number;
    source: string;
    label: string;
    kind: WriterKind;
    paths: readonly string[];
};

export type BindingConflict = {
    owner: string;
    loser: string;
    example: string;
    count: number;
};

export type PanelOwnership = {
    ownedPaths: ReadonlyMap<string, readonly string[]>;
    conflicts: readonly BindingConflict[];
};

function writerFor(
    binding: PanelBinding,
    id: number,
    section: string,
    pathIndex: PathIndex,
): PanelWriter {
    const of = (source: string, kind: WriterKind, paths: readonly string[]): PanelWriter => ({
        id,
        source,
        label: `${binding.type} binding "${source}" in "${section}"`,
        kind,
        paths,
    });

    switch (binding.type) {
        case "scale":
        case "link":
            return of(binding.token, "declarative", pathIndex.matching(binding.token));
        case "alias":
            return of(binding.token, "imperative", pathIndex.matching(binding.token));
        case "palette-swap":
            return of(binding.family, "imperative", pathIndex.under(binding.family));
    }
}

export function indexPanelOwnership(
    sections: PanelSection[],
    pathIndex: PathIndex,
): PanelOwnership {
    const writers: PanelWriter[] = [];
    for (const section of sections) {
        for (const binding of section.bindings) {
            writers.push(writerFor(binding, writers.length, section.title, pathIndex));
        }
    }

    const byId = new Map(writers.map((writer) => [writer.id, writer]));
    const ownerByPath = new Map<string, number>();
    const ownedByWriter = new Map<number, string[]>();
    const conflicts = new Map<string, BindingConflict>();

    function record(ownerId: number, loser: PanelWriter, example: string) {
        const owner = byId.get(ownerId);
        if (!owner) return;
        const key = `${ownerId} ${loser.id}`;
        const existing = conflicts.get(key);
        if (existing) existing.count += 1;
        else conflicts.set(key, { owner: owner.label, loser: loser.label, example, count: 1 });
    }

    for (const writer of writers) {
        if (writer.kind !== "declarative") continue;
        for (const path of writer.paths) {
            const ownerId = ownerByPath.get(path);
            if (ownerId !== undefined) {
                record(ownerId, writer, path);
                continue;
            }
            ownerByPath.set(path, writer.id);
            const owned = ownedByWriter.get(writer.id);
            if (owned) owned.push(path);
            else ownedByWriter.set(writer.id, [path]);
        }
    }

    for (const writer of writers) {
        if (writer.kind !== "imperative") continue;
        for (const path of writer.paths) {
            const ownerId = ownerByPath.get(path);
            if (ownerId !== undefined) record(ownerId, writer, path);
        }
    }

    const ownedPaths = new Map<string, readonly string[]>();
    for (const writer of writers) {
        if (writer.kind !== "declarative" || ownedPaths.has(writer.source)) continue;
        ownedPaths.set(writer.source, ownedByWriter.get(writer.id) ?? []);
    }

    return { ownedPaths, conflicts: [...conflicts.values()] };
}

export function conflictMessage({ owner, loser, example, count }: BindingConflict): string {
    const rest = count > 1 ? ` (and ${count - 1} more)` : "";
    return (
        `[studio] ${loser} and ${owner} both write "${example}"${rest}. ` +
        `The ${owner} rewrites its whole range whenever anything applies, so writes from the ` +
        `${loser} are discarded with no error and disappear from the diff. Bind one or the other.`
    );
}
