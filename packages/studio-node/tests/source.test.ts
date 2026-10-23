import { describe, expect, it } from "vitest";
import { gitSaveFor, repositoryFromRemote } from "../src/source";

describe("the repository a git remote points at", () => {
    it.for([
        ["https://github.com/acme/site.git"],
        ["https://github.com/acme/site"],
        ["https://github.com/acme/site/"],
        ["git@github.com:acme/site.git"],
        ["ssh://git@github.com/acme/site.git"],
        ["https://x-access-token:secret@github.com/acme/site.git"],
    ])("is acme/site for %s", ([remote]) => {
        expect(repositoryFromRemote(remote ?? "")).toBe("acme/site");
    });

    it("is unknown for a remote that isn't on GitHub", () => {
        expect(repositoryFromRemote("https://gitlab.com/acme/site.git")).toBeUndefined();
        expect(repositoryFromRemote("not a remote")).toBeUndefined();
    });
});

function gitAt(answers: Record<string, string>) {
    const asked: string[] = [];
    const git = (args: readonly string[]) => {
        asked.push(args.join(" "));
        return answers[args.join(" ")];
    };
    return { git, asked };
}

const checkout = () =>
    gitAt({
        "remote get-url origin": "git@github.com:acme/site.git",
        "branch --show-current": "redesign",
        "rev-parse --show-toplevel": "/work/site",
    });

const noCheckout = () => gitAt({});

describe("what the build writes down for saving", () => {
    it("takes the repository from studio's settings and the branch being built from the checkout", () => {
        const { gitSave } = gitSaveFor({
            studio: { repository: "acme/site", app: "acme-studio" },
            resolver: "design/tokens.resolver.json",
            cwd: "/work/site/apps/docs",
            git: checkout().git,
        });
        expect(gitSave).toStrictEqual({
            host: "github",
            repository: "acme/site",
            branch: "redesign",
            entry: "apps/docs/design/tokens.resolver.json",
            signIn: "/api/sugarcube-studio",
            install: "https://github.com/apps/acme-studio/installations/new",
        });
    });

    it("takes the branch from studio's settings when they give one, asking git nothing for it", () => {
        const { git, asked } = checkout();
        const { gitSave } = gitSaveFor({
            studio: { repository: "acme/site", branch: "main" },
            resolver: "tokens.resolver.json",
            cwd: "/work/site",
            git,
        });
        expect(gitSave?.branch).toBe("main");
        expect(asked).not.toContain("branch --show-current");
    });

    it("takes an absolute resolver path the same way", () => {
        const { gitSave } = gitSaveFor({
            studio: { repository: "acme/site" },
            resolver: "/work/site/tokens/tokens.resolver.json",
            cwd: "/work/site",
            git: checkout().git,
        });
        expect(gitSave?.entry).toBe("tokens/tokens.resolver.json");
    });

    it("takes the project's folder as the repository's root when there's no checkout to say", () => {
        const { gitSave } = gitSaveFor({
            studio: { repository: "acme/site", branch: "main" },
            resolver: "tokens/tokens.resolver.json",
            cwd: "/build",
            git: noCheckout().git,
        });
        expect(gitSave?.entry).toBe("tokens/tokens.resolver.json");
    });

    it("takes a sign-in function somewhere else", () => {
        expect(
            gitSaveFor({
                studio: { repository: "acme/site", signIn: "/auth/studio" },
                resolver: "tokens.resolver.json",
                cwd: "/work/site",
                git: checkout().git,
            }).gitSave?.signIn,
        ).toBe("/auth/studio");
    });

    it("warns, once, when there is no app name for the install link", () => {
        const { gitSave, warnings } = gitSaveFor({
            studio: { repository: "acme/site" },
            resolver: "tokens.resolver.json",
            cwd: "/work/site",
            git: checkout().git,
        });
        expect(gitSave?.install).toBeUndefined();
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("studio.app");
    });

    it("is nothing at all, and asks nothing, when saving is turned off", () => {
        const { git, asked } = noCheckout();
        expect(
            gitSaveFor({
                studio: { save: false },
                resolver: "tokens.resolver.json",
                cwd: "/x",
                git,
            }),
        ).toStrictEqual({ warnings: [] });
        expect(asked).toStrictEqual([]);
    });
});

describe("a build that can't tell where to save", () => {
    it("stops without a repository, suggesting the one the git remote names", () => {
        expect(() =>
            gitSaveFor({
                resolver: "tokens.resolver.json",
                cwd: "/work/site",
                git: checkout().git,
            }),
        ).toThrow(/studio\.repository.*"acme\/site"/s);
    });

    it("stops without a repository, saying what to set, when there's no remote to suggest", () => {
        expect(() =>
            gitSaveFor({ resolver: "tokens.resolver.json", cwd: "/build", git: noCheckout().git }),
        ).toThrow("studio.repository");
    });

    it("stops without a branch when there's no checkout to read it from", () => {
        expect(() =>
            gitSaveFor({
                studio: { repository: "acme/site" },
                resolver: "tokens.resolver.json",
                cwd: "/build",
                git: noCheckout().git,
            }),
        ).toThrow("studio.branch");
    });

    it("stops when the resolver isn't inside the repository", () => {
        expect(() =>
            gitSaveFor({
                studio: { repository: "acme/site" },
                resolver: "/elsewhere/tokens.resolver.json",
                cwd: "/elsewhere",
                git: checkout().git,
            }),
        ).toThrow("/elsewhere/tokens.resolver.json");
    });
});
