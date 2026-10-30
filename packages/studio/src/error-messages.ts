export const STUDIO_NAME = "sugarcube studio";

const prefix = `[${STUDIO_NAME}]`;

export const ErrorMessages = {
    NOT_EDITS: `${prefix} Refusing to save: what was sent is not a list of edits.`,
    NAMING_DROPPED:
        "The config names variables with a function, which cannot run in the browser. " +
        "The page preview and any variable name studio shows use the default naming.",
    NOTHING_TO_BUILD: (problems: string) =>
        `${prefix} Nothing to build: no tokens were read.\n${problems}`,
    NO_SUGARCUBE_PLUGIN: `${prefix} Could not find the sugarcube plugin. Is @sugarcube-sh/vite in this Vite config?`,
    NO_BROWSER: (reason: string, url: string) =>
        `${prefix} Could not open a browser (${reason}). Open ${url} yourself.`,
    READ_FAILED: `${prefix} Reading the token files failed:`,
    NO_MOUNT_POINT: `${prefix} The mount point "#root" is not in index.html.`,
    NO_MESSAGE: `${prefix} The host sent no token files. studio needs the files to show them.`,
    DEMO_FAILED: `${prefix} Reading the demo tokens failed:`,
    ENTRY_NOT_THERE: (entry: string, repository: string, branch: string) =>
        `${entry} is not in ${repository} on ${branch}.`,
    COULD_NOT_REACH: (host: string) => `Couldn't reach ${host}. Try again.`,
    TOO_MANY_REQUESTS: (at: string | undefined) =>
        at ? `Too many requests. Try again at ${at}.` : "Too many requests. Try again.",
    SINGLE_SIGN_ON: (owner: string) => `Sign in to ${owner} with single sign-on, then try again.`,
    APP_LACKS_PERMISSION: (repository: string) =>
        `studio's GitHub App needs permission to write to ${repository}.`,
    NOT_SIGNED_IN: "Not signed in. Try again.",
    CANT_SAVE: (repository: string) => `You can't save to ${repository}.`,
    NOT_INSTALLED: (repository: string) => `studio isn't installed on ${repository}.`,
    NO_REPOSITORY: (fromRemote: string | undefined) =>
        `${prefix} Saving needs the GitHub repository the tokens live in. Set studio.repository in sugarcube.config.ts${fromRemote ? ` (your git remote says "${fromRemote}")` : ""}, or turn saving off with studio.save: false.`,
    NO_BRANCH: `${prefix} Saving needs the branch the site is built from, and this build has no git checkout to read it from. Set studio.branch in sugarcube.config.ts, for example to your host's branch variable.`,
    RESOLVER_OUTSIDE_REPOSITORY: (resolver: string) =>
        `${prefix} The resolver ${resolver} isn't inside this git checkout, so studio can't tell where it is in the repository.`,
    NO_APP: `${prefix} Save is on, but studio.app isn't set in sugarcube.config.ts, so studio can't offer a button to install its GitHub App.`,
    SHORT_SECRET: (name: string, length: number) =>
        `${prefix} ${name} is too short. Use a random value of at least ${length} characters.`,
    MISSING_SETTING: (name: string) =>
        `${prefix} ${name} isn't set. The sign-in function needs it on the host.`,
} as const;

export class UserFacingError extends Error {
    override name = "UserFacingError";
}
