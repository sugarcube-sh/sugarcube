import { readFromMemory } from "@sugarcube-sh/dtcg";
import { type Edits, createSession, rename, setValue } from "@sugarcube-sh/dtcg-edit";
import { ForgeNetworkError } from "forges";
import { describe, expect, it } from "vitest";
import { createAdapter } from "../../src/adapters";
import { createGitSave } from "../../src/controllers/git-save";
import { createStudio } from "../../src/controllers/studio";
import { formatClashMessage } from "../../src/controllers/views";
import type { StudioMessage } from "../../src/protocol";
import { BUILT_COMMIT, fakeGitHub } from "../git-hosts/fake-github";
import { demoMessage } from "./demo-message";

const ENTRY = "tokens/tokens.resolver.json";

const RESOLVER = `{
  "version": "2025.10",
  "resolutionOrder": [
    { "type": "set", "name": "base", "sources": [{ "$ref": "color.json" }] },
    {
      "type": "modifier",
      "name": "mode",
      "default": "light",
      "contexts": { "light": [], "dark": [{ "$ref": "dark.json" }] }
    }
  ]
}
`;
const COLOR = `{
  "color": {
    "$type": "color",
    "neutral": {
      "50": { "$value": "#fafafa" },
      "100": { "$value": "#f5f5f5" },
      "900": { "$value": "#171717", "$description": "Café noir" }
    },
    "text": { "default": { "$value": "{color.neutral.900}" } }
  }
}
`;
const DARK = `{
  "color": {
    "text": { "default": { "$value": "{color.neutral.50}" } }
  }
}
`;
const FILES = { "tokens.resolver.json": RESOLVER, "color.json": COLOR, "dark.json": DARK };

const darkOptions = { input: { mode: "dark" } } as const;

function fakeGitHubWithTokens(files: Readonly<Record<string, string>>) {
    const github = fakeGitHub(
        Object.fromEntries(Object.entries(files).map(([file, text]) => [`tokens/${file}`, text])),
    );
    return {
        ...github,
        changeOnGitHub: (file: string, content: string) =>
            github.changeOnGitHub(`tokens/${file}`, content),
    };
}

function createEdits(...values: [path: string, value: string][]) {
    const session = createSession(
        readFromMemory({ files: FILES, entryFile: "tokens.resolver.json" }),
    );
    for (const [path, value] of values)
        session.do(setValue(session.tokens, path, value, darkOptions));
    return { edits: session.unsavedEdits, changes: session.getChanges() };
}

function createSave(github: ReturnType<typeof fakeGitHubWithTokens>) {
    const save = createGitSave({ host: github.host, entry: ENTRY });
    return ({ edits, changes }: ReturnType<typeof createEdits>) => save(edits, changes);
}

describe("a save to GitHub", () => {
    it("reads every file at the branch's latest commit", async () => {
        const github = fakeGitHubWithTokens(FILES);
        const moved = await github.changeOnGitHub("color.json", COLOR);
        const asked: string[] = [];
        const save = createGitSave({
            host: {
                ...github.host,
                getFile: (commit, path) => {
                    asked.push(commit);
                    return github.host.getFile(commit, path);
                },
            },
            entry: ENTRY,
        });
        const { edits, changes } = createEdits(["color.text.default", "{color.neutral.100}"]);
        await save(edits, changes);
        expect(new Set(asked)).toStrictEqual(new Set([moved.sha]));
    });

    it("commits only the file the edit changes, at its path in the repository, on the commit it read", async () => {
        const github = fakeGitHubWithTokens(FILES);
        await createSave(github)(createEdits(["color.text.default", "{color.neutral.100}"]));
        expect(await github.readOnBranch("tokens/dark.json")).toBe(
            DARK.replace("{color.neutral.50}", "{color.neutral.100}"),
        );
        expect(await github.readOnBranch("dark.json")).toBeUndefined();
        expect(github.lastCommit()?.parents).toStrictEqual([BUILT_COMMIT]);
    });

    it("keeps a change made on GitHub elsewhere in the same file", async () => {
        const github = fakeGitHubWithTokens(FILES);
        const elsewhere = DARK.replace(
            '{\n  "color"',
            '{\n  "space": { "$type": "number", "s": { "$value": 4 } },\n  "color"',
        );
        await github.changeOnGitHub("dark.json", elsewhere);
        await createSave(github)(createEdits(["color.text.default", "{color.neutral.100}"]));
        expect(await github.readOnBranch("tokens/dark.json")).toBe(
            elsewhere.replace("{color.neutral.50}", "{color.neutral.100}"),
        );
    });

    it("answers with the pull request and the files as it read them on GitHub", async () => {
        const github = fakeGitHubWithTokens(FILES);
        const now = COLOR.replace("#f5f5f5", "#eeeeee");
        await github.changeOnGitHub("color.json", now);
        const saved = await createSave(github)(
            createEdits(["color.text.default", "{color.neutral.100}"]),
        );
        expect(saved).toStrictEqual({
            pullRequest: { number: 1, url: "https://fake.test/acme/site/pull/1" },
            files: { ...FILES, "color.json": now },
        });
    });

    it("titles the pull request by the one change, and lists each change in its description", async () => {
        const github = fakeGitHubWithTokens(FILES);
        await createSave(github)(createEdits(["color.text.default", "{color.neutral.100}"]));
        expect(github.pulls()[0]?.thread).toMatchObject({
            title: "`color.text.default` changed (mode: dark)",
            body: "- `color.text.default` changed (mode: dark)",
        });
    });

    it("counts several changes in the title", async () => {
        const github = fakeGitHubWithTokens(FILES);
        await createSave(github)(
            createEdits(
                ["color.text.default", "{color.neutral.100}"],
                ["color.neutral.50", "#ffffff"],
            ),
        );
        const [pull] = github.pulls();
        expect(pull?.thread.title).toBe("2 changes from studio");
        expect(pull?.thread.body?.split("\n")).toHaveLength(2);
    });

    it("deletes a file an edit deletes", async () => {
        const github = fakeGitHubWithTokens(FILES);
        const edits: Edits = {
            steps: [
                {
                    ops: [
                        {
                            kind: "set",
                            file: "tokens.resolver.json",
                            jsonPath: ["resolutionOrder", 1, "contexts", "dark"],
                            value: [],
                            was: [{ $ref: "dark.json" }],
                        },
                        { kind: "delete-file", file: "dark.json", was: DARK },
                    ],
                    moves: [],
                },
            ],
        };
        await createGitSave({ host: github.host, entry: ENTRY })(edits, []);
        expect(github.pulls()).toHaveLength(1);
        expect(await github.readOnBranch("tokens/dark.json")).toBeUndefined();
        expect(await github.readOnBranch("tokens/color.json")).toBe(COLOR);
    });
});

describe("an entry the repository doesn't have", () => {
    it("is refused, naming it, and opens nothing", async () => {
        const github = fakeGitHubWithTokens({ "color.json": COLOR, "dark.json": DARK });
        await expect(
            createSave(github)(createEdits(["color.text.default", "{color.neutral.100}"])),
        ).rejects.toThrow("tokens/tokens.resolver.json is not in acme/site on main.");
        expect(github.pulls()).toStrictEqual([]);
    });
});

describe("a change on GitHub since the build", () => {
    it("is a clash, with the files as they are now and where they changed, and opens nothing", async () => {
        const github = fakeGitHubWithTokens(FILES);
        const now = DARK.replace("{color.neutral.50}", "{color.neutral.900}");
        await github.changeOnGitHub("dark.json", now);
        const saved = await createSave(github)(
            createEdits(["color.text.default", "{color.neutral.100}"]),
        );
        expect(saved.conflicts).toHaveLength(1);
        expect(saved.files).toStrictEqual({ ...FILES, "dark.json": now });
        expect(saved.changedHost).toBe("GitHub");
        expect(github.pulls()).toStrictEqual([]);
    });
});

describe("a save GitHub can't take", () => {
    it("says GitHub couldn't be reached, when it can't be", async () => {
        const github = fakeGitHubWithTokens(FILES);
        github.forge.offline();
        await expect(
            createSave(github)(createEdits(["color.text.default", "{color.neutral.100}"])),
        ).rejects.toThrow("Couldn't reach GitHub. Try again.");
    });

    it("says so when a file can't be fetched for want of a connection", async () => {
        const github = fakeGitHubWithTokens(FILES);
        github.forge.failNext(
            "contents.getFile",
            () => new ForgeNetworkError("offline", { forge: "fake", instance: "fake.test" }),
        );
        await expect(
            createSave(github)(createEdits(["color.text.default", "{color.neutral.100}"])),
        ).rejects.toThrow("Couldn't reach GitHub. Try again.");
    });
});

describe("saving from studio to GitHub", () => {
    function studioSavingTo(
        message: StudioMessage,
        github: ReturnType<typeof fakeGitHubWithTokens>,
    ) {
        return createStudio(
            message,
            createAdapter,
            createGitSave({ host: github.host, entry: `tokens/${message.entryFile}` }),
        );
    }

    it("saves a second time without the first save's changes showing as clashes", async () => {
        const message = demoMessage();
        const github = fakeGitHubWithTokens(message.files);
        const studio = studioSavingTo(message, github);
        studio.do(
            setValue(studio.state.tokens, "color.text.default", "{color.neutral.100}", darkOptions),
        );
        await studio.save?.();
        studio.do(
            setValue(studio.state.tokens, "color.text.muted", "{color.neutral.300}", darkOptions),
        );
        const second = await studio.save?.();
        expect(second?.conflicts).toBeUndefined();
        expect(github.pulls()).toHaveLength(2);
    });

    it("sends only the new change in a second save after a group rename, never the first save's rename again", async () => {
        const message = demoMessage();
        const github = fakeGitHubWithTokens(message.files);
        const studio = studioSavingTo(message, github);
        studio.do(rename(studio.state.tokens, "radius", "corner"));
        await studio.save?.();
        expect(studio.state.changes).toStrictEqual([]);
        studio.do(
            setValue(studio.state.tokens, "color.text.muted", "{color.neutral.300}", darkOptions),
        );
        await studio.save?.();
        const [, second] = github.pulls();
        const head = second?.thread.branches?.head.ref;
        expect(await github.readOnBranch("tokens/radius.json", head)).toBe(
            message.files["radius.json"],
        );
        expect(await github.readOnBranch("tokens/dark.json", head)).toContain(
            "{color.neutral.300}",
        );
        expect(second?.thread.title).toBe("`color.text.muted` changed (mode: dark)");
    });
});

describe("the line for a clash", () => {
    it("says where the files changed when the save knows", () => {
        expect(formatClashMessage({ changedHost: "GitHub" })).toBe("Not saved: changed on GitHub.");
    });

    it("says elsewhere when it doesn't", () => {
        expect(formatClashMessage({})).toBe("Not saved: changed elsewhere.");
    });
});
