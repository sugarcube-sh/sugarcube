import {
    type FetchLike,
    type ForgeProvider,
    type GitHubTokenAuth,
    NotFoundError,
    type RepoPermissions,
    type RepoRef,
    normaliseRepoName,
    repoKey,
    repoRef,
} from "forges";
import { github } from "forges/github";
import { type ForgeHostOptions, forgeHost, inPlainWords } from "./forge-host";
import type { Access, GitHost } from "./git-host";

export type GitHubHostOptions = Omit<ForgeHostOptions, "name"> & {
    readonly key: GitHubTokenAuth["token"];
    readonly install?: string | undefined;
    readonly fetch?: FetchLike;
};

export function githubHost({ key, install, fetch, ...options }: GitHubHostOptions): GitHost {
    const forge = github({
        auth: { type: "token", token: key, kind: "app-user" },
        ...(fetch && { fetch }),
    });
    const host = forgeHost(forge, { name: "GitHub", ...options });
    const plainly = inPlainWords(host.name, repoRef(forge, host.repository));
    return {
        ...host,
        access: () =>
            plainly(async () =>
                accessFrom(await accessFacts(forge, repoRef(forge, host.repository)), install),
            ),
    };
}

export type AccessFacts = {
    readonly installed: boolean;
    readonly permissions: RepoPermissions | undefined;
};

export function accessFrom({ installed, permissions }: AccessFacts, install?: string): Access {
    if (!installed)
        return install
            ? { can: "nothing", reason: "not-installed", install }
            : { can: "nothing", reason: "not-installed" };
    if (permissions?.push) return { can: "write" };
    if (permissions?.pull) return { can: "read" };
    return { can: "nothing", reason: "no-access" };
}

type Installation = {
    readonly id: number;
    readonly account: { readonly login: string };
    readonly repository_selection: "all" | "selected";
};

type InstallationRepository = {
    readonly full_name: string;
    readonly permissions?: RepoPermissions;
};

const PER_PAGE = 100;

async function accessFacts(forge: ForgeProvider, repo: RepoRef): Promise<AccessFacts> {
    const { data } = await forge.request<{ installations: Installation[] }>(
        "GET",
        "/user/installations",
        { query: { per_page: PER_PAGE } },
    );
    const installation = data.installations.find(({ account }) => sameOwner(repo, account.login));
    if (!installation) return { installed: false, permissions: undefined };
    if (installation.repository_selection === "selected") {
        const listed = await listedRepository(forge, installation.id, repo);
        return { installed: listed !== undefined, permissions: listed?.permissions };
    }
    try {
        const { permissions } = await forge.repos.get(repo);
        return { installed: true, permissions };
    } catch (error) {
        if (error instanceof NotFoundError) return { installed: true, permissions: undefined };
        throw error;
    }
}

async function listedRepository(
    forge: ForgeProvider,
    installation: number,
    repo: RepoRef,
): Promise<InstallationRepository | undefined> {
    for (let page = 1; ; page++) {
        const { data } = await forge.request<{ repositories: InstallationRepository[] }>(
            "GET",
            `/user/installations/${installation}/repositories`,
            { query: { per_page: PER_PAGE, page } },
        );
        const found = data.repositories.find(
            ({ full_name }) => repoKey(repoRef(forge, full_name)) === repoKey(repo),
        );
        if (found || data.repositories.length < PER_PAGE) return found;
    }
}

function sameOwner(repo: RepoRef, owner: string): boolean {
    return normaliseRepoName({ ...repo, owner }).owner === normaliseRepoName(repo).owner;
}
