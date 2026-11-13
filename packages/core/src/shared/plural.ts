export function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
