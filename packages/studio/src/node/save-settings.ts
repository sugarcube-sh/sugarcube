import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { InternalConfig } from "@sugarcube-sh/core";
import { ErrorMessages } from "../error-messages";
import type { GitSaveSettings } from "../protocol";
import { STUDIO_SIGN_IN_BASE } from "../studio-names";

export type Git = (args: readonly string[]) => string | undefined;

export function getGitSaveSettings({
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
                parseGitHubRepository(git(["remote", "get-url", "origin"]) ?? ""),
            ),
        );
    const branch = studio.branch ?? git(["branch", "--show-current"]);
    if (!branch) throw new Error(ErrorMessages.NO_BRANCH);
    const entry = getRepositoryPath(resolve(cwd, resolver), cwd, git);
    const gitSave = {
        host: "github",
        repository,
        branch,
        entry,
        signIn: studio.signInPath ?? STUDIO_SIGN_IN_BASE,
    } as const;
    if (!studio.githubApp) return { gitSave, warnings: [ErrorMessages.NO_GITHUB_APP] };
    return {
        gitSave: {
            ...gitSave,
            install: `https://github.com/apps/${studio.githubApp}/installations/new`,
        },
        warnings: [],
    };
}

export function parseGitHubRepository(remote: string): string | undefined {
    const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote.trim());
    return match ? `${match[1]}/${match[2]}` : undefined;
}

function getRepositoryPath(resolver: string, cwd: string, git: Git): string {
    const checkoutRoot = git(["rev-parse", "--show-toplevel"]) ?? cwd;
    const path = relative(checkoutRoot, resolver);
    if (path.startsWith("..") || isAbsolute(path))
        throw new Error(ErrorMessages.RESOLVER_OUTSIDE_REPOSITORY(resolver));
    return path.split(sep).join("/");
}

export function createGit(cwd: string): Git {
    return (args) => {
        try {
            const output = execFileSync("git", args, {
                cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            });
            return output.trim() || undefined;
        } catch {
            return undefined;
        }
    };
}
