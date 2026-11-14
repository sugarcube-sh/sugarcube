import { useState } from "react";
import { moveListItem, removeListItem } from "../controllers/lists";

export function useDraft<D>(
    initial: D,
    resetKey: string,
    sameValue: (draft: D) => boolean = () => false,
): [D, (next: D) => void] {
    const [draft, setDraft] = useState(initial);
    const [lastResetKey, setLastResetKey] = useState(resetKey);
    if (lastResetKey !== resetKey) {
        setLastResetKey(resetKey);
        if (!sameValue(draft)) setDraft(initial);
    }
    return [draft, setDraft];
}

export interface ItemKeys {
    readonly keys: readonly number[];
    add(): void;
    remove(at: number): void;
    move(from: number, to: number): void;
}

export function useItemKeys(count: number): ItemKeys {
    const [keys, setKeys] = useState<readonly number[]>(() => createKeys(count));
    if (keys.length !== count) setKeys(createKeys(count));
    return {
        keys,
        add: () => setKeys([...keys, ...createKeys(1)]),
        remove: (at) => setKeys(removeListItem(keys, at)),
        move: (from, to) => setKeys(moveListItem(keys, from, to)),
    };
}

let lastKey = 0;

function createKeys(count: number): number[] {
    return Array.from({ length: count }, () => {
        lastKey += 1;
        return lastKey;
    });
}
