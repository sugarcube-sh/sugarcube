// Fake functions that a consumer might call so we can test our types.

declare function askPerson(candidates: readonly string[]): Promise<string>;
declare function showMessage(message: string): void;
declare function showBroken(authored: unknown, problems: readonly { message: string }[]): void;
declare function openPullRequest(
    changes: { written: Record<string, string>; deleted: string[] },
    pr: { title: string; body: string },
): Promise<void>;
declare function commentOnFigma(message: string): Promise<void>;
declare function download(name: string, text: string): void;
declare function row(...cells: unknown[]): void;
declare function report(
    where: { file: string; offset: number; length: number },
    message: string,
): void;
declare function goTo(where: { file: string; offset: number; length: number }): void;
declare function showConflicts(conflicts: { reason: string }[]): void;
declare function showClash(where: string, yours: unknown, theirs: unknown): void;
declare function fromGit(ref: string): (path: string) => Promise<string | undefined>;
declare function comment(text: string): void;
declare const figmaValue: string;
declare const fromUrl: string;
declare const input: { value: string; setCustomValidity(message: string): void };

declare const Deno: { readTextFile(path: string): Promise<string> };
