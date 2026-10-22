import type { Group, Token } from "@sugarcube-sh/dtcg";
import { rename, setDescription } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { render } from "vitest-browser-react";
import { plain } from "../../src/adapters/plain";
import { NewToken } from "../../src/canvas/NewToken";
import { TokenPage } from "../../src/canvas/TokenPage";
import { createStudio } from "../../src/controllers/studio";
import { StudioContext, useStudioState } from "../../src/providers/studio-context";

const files = {
    "tokens.resolver.json": JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "./dark.json" }] },
            },
        ],
    }),
    "base.json": JSON.stringify({
        color: {
            $type: "color",
            brand: {
                $value: { colorSpace: "oklch", components: [0.624, 0.181, 258], hex: "#3884f2" },
            },
            vivid: { $value: { colorSpace: "oklch", components: [0.7, 0.28, 145] } },
        },
        space: { $type: "dimension", s: { $value: { value: 4, unit: "px" } } },
        legacy: { $type: "number", $deprecated: "Use space", n: { $value: 1 } },
        shadow: {
            $type: "shadow",
            sm: {
                $value: {
                    color: "#00000033",
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 1, unit: "px" },
                    blur: { value: 2, unit: "px" },
                    spread: { value: 0, unit: "px" },
                },
            },
        },
        border: {
            $type: "border",
            card: {
                $value: {
                    color: "#000000",
                    width: { value: 1, unit: "px" },
                    style: { dashArray: [{ value: 4, unit: "px" }], lineCap: "round" },
                },
            },
        },
    }),
    "dark.json": JSON.stringify({
        space: { $type: "dimension", m: { $value: { value: 8, unit: "px" } } },
    }),
};

function studioOnFiles() {
    return createStudio(
        {
            adapter: { name: "plain", settings: {}, problems: [] },
            entry: "tokens.resolver.json",
            files,
        },
        (sent) => plain(sent.name === "plain" ? sent.settings : {}),
    );
}

function CurrentToken({ path }: { path: string }) {
    const showing = useStudioState((state) => state.showing);
    return <TokenPage token={showing.token(path) as Token} shown />;
}

function studioPage(path: string) {
    const studio = studioOnFiles();
    const Page = () => (
        <MemoryRouter>
            <StudioContext.Provider value={studio}>
                <CurrentToken path={path} />
            </StudioContext.Provider>
        </MemoryRouter>
    );
    return { studio, Page };
}

describe("an override", () => {
    it("starts from the value in force, and keeps your cursor once it is written", async () => {
        const { studio, Page } = studioPage("space.s");
        const screen = await render(<Page />);

        await screen.getByRole("button", { name: "Override for mode: dark" }).click();
        const box = screen.getByRole("spinbutton", { name: "Override for mode: dark, amount" });
        await expect.element(box).toHaveValue(4);

        await box.fill("6");

        const written = screen.getByRole("spinbutton", { name: "mode: dark, amount" });
        await expect.element(written).toHaveValue(6);
        await expect.element(written).toHaveFocus();
        expect(studio.state.tokens.text("dark.json")).toContain('"s"');
    });
});

describe("a new token", () => {
    it("is added once its field holds a whole value", async () => {
        const studio = studioOnFiles();
        const group = studio.state.showing.group("space") as Group;
        const screen = await render(
            <StudioContext.Provider value={studio}>
                <NewToken group={group} />
            </StudioContext.Provider>,
        );
        const add = screen.getByRole("button", { name: "Add" });

        const form = screen.getByRole("form", { name: "New token" });
        await form.getByRole("textbox", { name: "Name" }).fill("l");
        await screen.getByRole("spinbutton", { name: "Value, amount" }).fill("12");
        await expect.element(add).toBeDisabled();
        await screen.getByRole("combobox", { name: "Value, unit" }).selectOptions("px");
        await expect.element(add).toBeEnabled();
        await add.click();

        expect(studio.state.showing.token("space.l")?.authored?.value).toEqual({
            value: 12,
            unit: "px",
        });
    });
});

describe("a composite", () => {
    it("writes only the part you change", async () => {
        const { studio, Page } = studioPage("shadow.sm");
        const screen = await render(<Page />);

        await screen.getByRole("spinbutton", { name: "base, layer 1, blur, amount" }).fill("8");

        const written = JSON.parse(studio.state.tokens.text("base.json") ?? "{}").shadow.sm.$value;
        expect(written).toEqual({
            color: "#00000033",
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 1, unit: "px" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
        });
    });

    it("reaches a part inside a part, and adds a layer as a copy of the last", async () => {
        const { studio, Page } = studioPage("border.card");
        const screen = await render(<Page />);

        await screen.getByRole("spinbutton", { name: "base, style, dash 1, amount" }).fill("6");
        await screen.getByRole("button", { name: "Add dash" }).click();

        const style = JSON.parse(studio.state.tokens.text("base.json") ?? "{}").border.card.$value
            .style;
        expect(style).toEqual({
            dashArray: [
                { value: 6, unit: "px" },
                { value: 6, unit: "px" },
            ],
            lineCap: "round",
        });
    });
});

describe("undo steps", () => {
    it("makes typing in one box one step, and switching the colour space one of its own", async () => {
        const { studio, Page } = studioPage("color.brand");
        const screen = await render(<Page />);
        const chroma = screen.getByRole("textbox", { name: "base, C" });

        await chroma.fill("0.1");
        await chroma.fill("0.12");
        expect(studio.unsaved.steps).toHaveLength(1);

        await screen
            .getByRole("combobox", { name: "base, colour space" })
            .selectOptions("display-p3");
        expect(studio.unsaved.steps).toHaveLength(2);

        studio.undo();
        const written = JSON.parse(studio.state.tokens.text("base.json") ?? "{}").color.brand
            .$value;
        expect(written).toMatchObject({ colorSpace: "oklch", components: [0.624, 0.12, 258] });
    });

    it("makes each part of a composite its own step", async () => {
        const { studio, Page } = studioPage("shadow.sm");
        const screen = await render(<Page />);
        const blur = screen.getByRole("spinbutton", { name: "base, layer 1, blur, amount" });

        await blur.fill("8");
        await blur.fill("9");
        await screen.getByRole("spinbutton", { name: "base, layer 1, offsetX, amount" }).fill("3");

        expect(studio.unsaved.steps).toHaveLength(2);
    });
});

describe("description and deprecation", () => {
    const written = (studio: ReturnType<typeof studioOnFiles>) =>
        JSON.parse(studio.state.tokens.text("base.json") ?? "{}");

    it("writes a description as you type, as one step, and removes it when emptied", async () => {
        const { studio, Page } = studioPage("space.s");
        const screen = await render(<Page />);
        const box = screen.getByRole("textbox", { name: "Description" });

        await box.fill("Small gaps.");
        expect(written(studio).space.s.$description).toBe("Small gaps.");
        expect(studio.unsaved.steps).toHaveLength(1);

        await box.fill("");
        expect(written(studio).space.s).not.toHaveProperty("$description");
        expect(studio.unsaved.steps).toHaveLength(0);
    });

    it("marks a token deprecated with a reason, as one step, and unmarks it", async () => {
        const { studio, Page } = studioPage("space.s");
        const screen = await render(<Page />);
        const box = screen.getByRole("checkbox", { name: "Deprecated" });

        await box.click();
        expect(written(studio).space.s.$deprecated).toBe(true);
        const reason = screen.getByRole("textbox", { name: "Reason" });
        await expect.element(reason).toHaveAttribute("placeholder", "Optional");
        await reason.fill("Use space.m");
        expect(written(studio).space.s.$deprecated).toBe("Use space.m");
        await expect.element(screen.getByText("Deprecated: Use space.m.")).toBeVisible();
        expect(studio.unsaved.steps).toHaveLength(1);

        await box.click();
        expect(written(studio).space.s).not.toHaveProperty("$deprecated");
    });

    it("names the group a token's deprecation comes from, and offers no box", async () => {
        const { Page } = studioPage("legacy.n");
        const screen = await render(<Page />);

        await expect.element(screen.getByText("Deprecated by legacy: Use space.")).toBeVisible();
        await expect
            .element(screen.getByRole("checkbox", { name: "Deprecated" }))
            .not.toBeInTheDocument();
    });
});

describe("what the page shows goes with what it is about", () => {
    it("drops the chroma note once Undo takes the switch back", async () => {
        const { studio, Page } = studioPage("color.vivid");
        const screen = await render(<Page />);

        await screen.getByRole("combobox", { name: "base, colour space" }).selectOptions("srgb");
        await expect.element(screen.getByText("Chroma reduced to fit sRGB.")).toBeVisible();

        studio.undo();
        await expect
            .element(screen.getByText("Chroma reduced to fit sRGB."))
            .not.toBeInTheDocument();
    });

    it("drops a refusal once another edit is made", async () => {
        const { studio, Page } = studioPage("space.s");
        const screen = await render(<Page />);
        const refused = rename(studio.state.tokens, "space.s", "a.b").refused?.reason ?? "";
        const form = screen.getByRole("form", { name: "Rename" });

        await form.getByRole("textbox", { name: "Name" }).fill("a.b");
        await form.getByRole("button", { name: "Rename" }).click();
        await expect.element(screen.getByText(refused)).toBeVisible();

        studio.do(setDescription(studio.state.tokens, "space.s", "Small."));
        await expect.element(screen.getByText(refused)).not.toBeInTheDocument();
    });

    it("forgets overrides being added when it shows another token", async () => {
        const studio = studioOnFiles();
        const page = (path: string) => (
            <MemoryRouter>
                <StudioContext.Provider value={studio}>
                    <TokenPage token={studio.state.showing.token(path) as Token} shown />
                </StudioContext.Provider>
            </MemoryRouter>
        );
        const screen = await render(page("space.s"));
        await screen.getByRole("button", { name: "Override for mode: dark" }).click();

        await screen.rerender(page("legacy.n"));

        await expect
            .element(screen.getByRole("button", { name: "Override for mode: dark" }))
            .toBeVisible();
    });
});
