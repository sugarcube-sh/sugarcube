import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { validateSugarcubeConfig } from "../src/shared/config.js";
import { mistakesIn } from "./config-mistakes.js";

const issues = (studio: unknown): string[] => mistakesIn({ studio });

describe("studio's settings", () => {
    it("are where the tokens live on GitHub, whether Save is on, and where sign-in is", () => {
        const studio = {
            repository: "acme/site",
            branch: "main",
            githubApp: "acme-studio",
            save: false,
            signInPath: "/auth/studio",
        };
        expect(issues(studio)).toStrictEqual([]);
        expect(validateSugarcubeConfig({ studio })).toStrictEqual({ studio });
    });

    it("are all optional", () => {
        expect(issues({})).toStrictEqual([]);
        expect(validateSugarcubeConfig({})).toStrictEqual({});
    });

    it.for(["acme", "acme/site/extra", "https://github.com/acme/site", "acme site"])(
        "refuse a repository written as %s, saying how to write it",
        (repository) => {
            expect(issues({ repository })[0]).toContain('"owner/name"');
        },
    );

    it.for(["Acme Studio", "acme/studio", "acme-studio?x=1", "-acme"])(
        "refuse an app name GitHub wouldn't give, such as %s",
        (githubApp) => {
            expect(issues({ githubApp })[0]).toContain("studio.githubApp");
        },
    );

    it.for(["auth/studio", "//evil.example/auth", "https://acme.com/auth"])(
        "refuse a sign-in address that isn't a path on the site: %s",
        (signInPath) => {
            expect(issues({ signInPath })[0]).toContain("/api/sugarcube-studio");
        },
    );

    it("reach the config every tool reads", () => {
        expect(fillDefaults({ studio: { repository: "acme/site" } }).studio).toStrictEqual({
            repository: "acme/site",
        });
    });
});
