import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { validateSugarcubeConfig } from "../src/shared/config.js";
import { ConfigError, configProblems } from "../src/shared/config-error.js";

const issues = (studio: unknown): string[] => {
    try {
        validateSugarcubeConfig({ studio });
        return [];
    } catch (error) {
        if (!(error instanceof ConfigError)) throw error;
        return configProblems(error).map(({ message }) => message);
    }
};

describe("studio's settings", () => {
    it("are where the tokens live on GitHub, whether Save is on, and where sign-in is", () => {
        const studio = {
            repository: "acme/site",
            branch: "main",
            app: "acme-studio",
            save: false,
            signIn: "/auth/studio",
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
        (app) => {
            expect(issues({ app })[0]).toContain("studio.app");
        },
    );

    it.for(["auth/studio", "//evil.example/auth", "https://acme.com/auth"])(
        "refuse a sign-in address that isn't a path on the site: %s",
        (signIn) => {
            expect(issues({ signIn })[0]).toContain("/api/sugarcube-studio");
        },
    );

    it("reach the config every tool reads", () => {
        expect(fillDefaults({ studio: { repository: "acme/site" } }).studio).toStrictEqual({
            repository: "acme/site",
        });
    });
});
