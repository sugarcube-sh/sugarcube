import type { Group } from "@sugarcube-sh/dtcg";
import { setValue } from "@sugarcube-sh/dtcg-edit";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { plain } from "../../src/adapters/plain";
import { GroupPage } from "../../src/canvas/GroupPage";
import { NodeActions } from "../../src/canvas/NodeActions";
import { NodeRoute } from "../../src/canvas/NodeRoute";
import { createStudio } from "../../src/controllers/studio";
import { StudioContext } from "../../src/providers/studio-context";

function studioOnFiles() {
    return createStudio(
        {
            adapter: { name: "plain", settings: {}, problems: [] },
            entry: "tokens.json",
            files: {
                "tokens.json": JSON.stringify({
                    space: { $type: "number", s: { $value: 4 } },
                    gap: { $type: "number", $value: "{space.s}" },
                    button: { $type: "number", icon: { size: { $value: 1 } } },
                    primary: { $extends: "{button}" },
                }),
            },
        },
        (sent) => plain(sent.name === "plain" ? sent.settings : {}),
    );
}

function onPage(path: string) {
    const studio = studioOnFiles();
    const screen = render(
        <MemoryRouter initialEntries={[`/${path.split(".").join("/")}`]}>
            <StudioContext.Provider value={studio}>
                <NodeRoute />
            </StudioContext.Provider>
        </MemoryRouter>,
    );
    return { studio, screen };
}

describe("a group's page", () => {
    it("renames the group, and stays on it under its new name", async () => {
        const { studio, screen } = onPage("space");
        const page = await screen;

        const rename = page.getByRole("form", { name: "Rename" });
        await rename.getByRole("textbox", { name: "Name" }).fill("size");
        await rename.getByRole("button", { name: "Rename" }).click();

        expect(studio.state.showing.group("size")).toBeDefined();
        await expect.element(page.getByRole("heading", { name: "size", level: 1 })).toBeVisible();
    });

    it("says what removing the group would break, and removes it when asked", async () => {
        const { studio, screen } = onPage("space");
        const page = await screen;

        await page.getByRole("button", { name: "Remove", exact: true }).click();
        await expect.element(page.getByText("Breaks")).toHaveTextContent("Breaks gap.");
        await page.getByRole("button", { name: "Remove anyway" }).click();

        expect(studio.state.showing.group("space")).toBeUndefined();
    });

    it("adds a group inside it and goes to the new group's page", async () => {
        const { studio, screen } = onPage("space");
        const page = await screen;
        const group = page.getByRole("form", { name: "New group" });

        await group.getByRole("textbox", { name: "Name" }).fill("large");
        await group.getByRole("button", { name: "Add" }).click();

        expect(studio.state.showing.group("space.large")).toBeDefined();
        await expect
            .element(page.getByRole("heading", { name: "space.large", level: 1 }))
            .toBeVisible();
    });

    it("offers no actions on a group only there through $extends", async () => {
        const { screen } = onPage("primary.icon");
        const page = await screen;

        await expect.element(page.getByRole("heading", { name: "primary.icon" })).toBeVisible();
        await expect.element(page.getByRole("button", { name: "Rename" })).not.toBeInTheDocument();
        await expect.element(page.getByText("New group")).not.toBeInTheDocument();
        await expect.element(page.getByText("New token")).not.toBeInTheDocument();
    });
});

describe("the Rename box", () => {
    it("shows the current name when the path changes, without being drawn again from scratch", async () => {
        const studio = studioOnFiles();
        const actions = (path: string) => (
            <StudioContext.Provider value={studio}>
                <NodeActions path={path} />
            </StudioContext.Provider>
        );
        const screen = await render(actions("space"));

        await screen.rerender(actions("gap"));

        await expect
            .element(screen.getByRole("form", { name: "Rename" }).getByRole("textbox"))
            .toHaveValue("gap");
    });
});

describe("the New token and New group forms", () => {
    it("start empty when the page shows another group", async () => {
        const studio = studioOnFiles();
        const page = (path: string) => (
            <MemoryRouter>
                <StudioContext.Provider value={studio}>
                    <GroupPage group={studio.state.showing.group(path) as Group} shown />
                </StudioContext.Provider>
            </MemoryRouter>
        );
        const screen = await render(page("space"));
        const token = screen.getByRole("form", { name: "New token" });
        const group = screen.getByRole("form", { name: "New group" });
        await token.getByRole("textbox", { name: "Name" }).fill("l");
        await group.getByRole("textbox", { name: "Name" }).fill("large");

        await screen.rerender(page("button"));

        await expect.element(token.getByRole("textbox", { name: "Name" })).toHaveValue("");
        await expect.element(group.getByRole("textbox", { name: "Name" })).toHaveValue("");
    });
});

describe("a question about which file to write in", () => {
    it("goes once another edit is made", async () => {
        const accent = JSON.stringify({ accent: { glow: { $type: "number", $value: 1 } } });
        const studio = createStudio(
            {
                adapter: { name: "plain", settings: {}, problems: [] },
                entry: "tokens.resolver.json",
                files: {
                    "tokens.resolver.json": JSON.stringify({
                        version: "2025.10",
                        resolutionOrder: [
                            { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                            {
                                type: "modifier",
                                name: "mode",
                                default: "light",
                                contexts: {
                                    light: [],
                                    dark: [{ $ref: "./dark.json" }],
                                    dim: [{ $ref: "./dim.json" }],
                                },
                            },
                        ],
                    }),
                    "base.json": JSON.stringify({ n: { $type: "number", $value: 1 } }),
                    "dark.json": accent,
                    "dim.json": accent,
                },
            },
            (sent) => plain(sent.name === "plain" ? sent.settings : {}),
        );
        const screen = await render(
            <MemoryRouter>
                <StudioContext.Provider value={studio}>
                    <GroupPage
                        group={
                            studio.state.tokens
                                .permutation({ mode: "dark" })
                                .group("accent") as Group
                        }
                        shown
                    />
                </StudioContext.Provider>
            </MemoryRouter>,
        );

        await screen.getByRole("textbox", { name: "Description" }).fill("Glow.");
        await expect.element(screen.getByText("Which file?")).toBeVisible();

        studio.do(setValue(studio.state.tokens, "n", 2));
        await expect.element(screen.getByText("Which file?")).not.toBeInTheDocument();
    });
});
