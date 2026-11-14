export function moveListItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = [...list];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    return next;
}

export function removeListItem<T>(list: readonly T[], at: number): T[] {
    return list.filter((_, index) => index !== at);
}
