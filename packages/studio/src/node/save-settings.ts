import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { InternalConfig } from "@sugarcube-sh/core";
import { ErrorMessages } from "../error-messages";
import type { GitSaveSettings } from "../protocol";
import { STUDIO_SIGN_IN_BASE } from "../studio-names";

export type Git = (args: readonly string[]) => string | undefined;

export function gitSaveFor({
    studio = {},
    resolver,
    cwd,
    git,
}: {
    studio?: InternalConfig["studio"];
    resolver: string;
    cwd: string;
    git: Git;
}): { gitSave?: GitSaveSettings; warnings: readonly string[] } {
    if (studio.save === false) return { warnings: [] };
    const { repository } = studio;
    if (!repository)
        throw new Error(
            ErrorMessages.NO_REPOSITORY(
                repositoryFromRemote(git(["remote", "get-url", "origin"]) ?? ""),
            ),
        );
    const branch = studio.branch ?? git(["branch", "--show-current"]);
    if (!branch) throw new Error(ErrorMessages.NO_BRANCH);
    const entry = entryInRepository(resolve(cwd, resolver), cwd, git);
    const gitSave = {
        host: "github",
        repository,
        branch,
        entry,
        signIn: studio.signIn ?? STUDIO_SIGN_IN_BASE,
    } as const;
    if (!studio.app) return { gitSave, warnings: [ErrorMessages.NO_APP] };
    return {
        gitSave: { ...gitSave, install: `https://github.com/apps/${studio.app}/installations/new` },
        warnings: [],
    };
}

export function repositoryFromRemote(remote: string): string | undefined {
    const found = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim());
    return found ? `${found[1]}/${found[2]}` : undefined;
}

function entryInRepository(resolver: string, cwd: string, git: Git): string {
    const top = git(["rev-parse", "--show-toplevel"]) ?? cwd;
    const path = relative(top, resolver);
    if (path.startsWith("..") || isAbsolute(path))
        throw new Error(ErrorMessages.RESOLVER_OUTSIDE_REPOSITORY(resolver));
    return path.split(sep).join("/");
}

export function gitIn(cwd: string): Git {
    return (args) => {
        try {
            const answer = execFileSync("git", args, {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            });
            return answer.trim() || undefined;
        } catch {
            return undefined;
        }
    };
}
