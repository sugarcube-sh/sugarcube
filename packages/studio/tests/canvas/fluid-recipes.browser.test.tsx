import type { Group, Token } from "@sugarcube-sh/dtcg";
import { fillDefaultsCore } from "@sugarcube-sh/core/client";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import size from "../../demo/size.json?raw";
import { adapterFor } from "../../src/adapters";
import { GroupPage } from "../../src/canvas/GroupPage";
import { TokenPage } from "../../src/canvas/TokenPage";
import { createStudio } from "../../src/controllers/studio";
import { StudioContext } from "../../src/providers/studio-context";

const entry = "tokens.resolver.json";

function sizeStudio() {
    const settings = fillDefaultsCore(
        { resolver: entry },
        { stylesDir: "src/styles", componentsDir: "src/components" },
    );
    return createStudio(
        {
            adapter: { name: "sugarcube", settings, problems: [] },
            entry,
            files: {
                [entry]: JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "./size.json" }] },
                    ],
                }),
                "size.json": size,
            },
        },
        adapterFor,
    );
}

function sizeJson(studio: ReturnType<typeof sizeStudio>) {
    return JSON.parse(studio.state.tokens.text("size.json") ?? "null").size;
}

function onPage(studio: ReturnType<typeof sizeStudio>, page: React.ReactNode) {
    return render(
        <MemoryRouter>
            <StudioContext.Provider value={studio}>{page}</StudioContext.Provider>
        </MemoryRouter>,
    );
}

describe("a fluid token's page", () => {
    it("edits the range with dimension fields, and From reaches the file", async () => {
        const studio = sizeStudio();
        const gutter = studio.state.showing.token("size.fluid.gutter") as Token;
        const screen = await onPage(studio, <TokenPage token={gutter} shown />);

        const from = screen.getByRole("spinbutton", { name: "base, Fluid, From, amount" });
        await expect.element(from).toHaveValue(1);
        await from.fill("1.5");

        expect(sizeJson(studio).fluid.gutter.$extensions["sh.sugarcube"].fluid.min).toEqual({
            value: 1.5,
            unit: "rem",
        });
        await expect.element(from).toHaveValue(1.5);
        await expect.element(from).toHaveFocus();
        expect(screen.getByRole("radio", { name: "Token" }).all()).toHaveLength(1);
    });
});

describe("a token's Token side", () => {
    it("lists the tokens of its type, leaving out the token being edited", async () => {
        const studio = sizeStudio();
        const gutter = studio.state.showing.token("size.fluid.gutter") as Token;
        const screen = await onPage(studio, <TokenPage token={gutter} shown />);

        await screen.getByRole("radio", { name: "Token" }).click();
        const listed = [...screen.container.querySelectorAll("datalist option")].map(
            (option) => (option as HTMLOptionElement).value,
        );

        expect(listed).toContain("size.fluid.measure");
        expect(listed).not.toContain("size.fluid.gutter");
    });
});

describe("a recipe's step page", () => {
    it("says which recipe makes it, links there, and shows its range without editing", async () => {
        const studio = sizeStudio();
        const step = studio.state.showing.token("size.step.-1") as Token;
        const screen = await onPage(studio, <TokenPage token={step} shown />);

        await expect.element(screen.getByText("Made by the scale on")).toBeInTheDocument();
        await expect.element(screen.getByRole("link", { name: "size.step" })).toBeInTheDocument();
        await expect.element(screen.getByText("0.8333rem", { exact: true })).toBeInTheDocument();
        expect(screen.getByRole("spinbutton").all()).toHaveLength(0);
        expect(screen.getByRole("button", { name: "Rename" }).all()).toHaveLength(0);
        expect(screen.getByRole("button", { name: "Remove" }).all()).toHaveLength(0);
    });
});

describe("a recipe's group page", () => {
    it("edits the recipe, and the change reaches the file", async () => {
        const studio = sizeStudio();
        const group = studio.state.showing.group("size.step") as Group;
        const screen = await onPage(studio, <GroupPage group={group} shown />);

        const ratio = screen.getByRole("spinbutton", { name: "Scale, Ratio to" });
        await expect.element(ratio).toHaveValue(1.25);
        await ratio.fill("1.333");

        expect(sizeJson(studio).step.$extensions["sh.sugarcube"].scale.ratio.max).toBe(1.333);
        await expect.element(ratio).toHaveValue(1.333);
        await expect.element(ratio).toHaveFocus();
    });
});
