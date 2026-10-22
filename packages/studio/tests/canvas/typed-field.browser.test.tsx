import type { JsonValue, TokenType } from "@sugarcube-sh/dtcg";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { TypedField } from "../../src/canvas/TypedField";

function Row({ type, start }: { type: TokenType | undefined; start: JsonValue }) {
    const [written, setWritten] = useState(start);
    return (
        <>
            <TypedField type={type} written={written} label="base" onWrite={setWritten} />
            <output aria-label="written">{JSON.stringify(written)}</output>
        </>
    );
}

describe("a number field", () => {
    it("writes what you type", async () => {
        const screen = await render(<Row type="number" start={1.5} />);

        await screen.getByRole("spinbutton", { name: "base" }).fill("3");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent("3");
    });
});

describe("typing", () => {
    it("keeps what you typed when the file then says the same thing", async () => {
        const screen = await render(<Row type="number" start={1.5} />);
        const box = screen.getByRole("spinbutton", { name: "base" });

        await box.fill("1e2");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent("100");
        await expect.element(box).toHaveDisplayValue("1e2");
    });
});

describe("the JSON box", () => {
    it("keeps your text, spaces and all, once what you wrote is in the file", async () => {
        const screen = await render(
            <Row type={undefined} start={{ colorSpace: "srgb", components: [0, 0, 0] }} />,
        );
        const box = screen.getByRole("textbox", { name: "base" });
        const typed = '{ "colorSpace": "srgb", "components": [1, 0, 0] }';

        await box.fill(typed);
        await userEvent.keyboard("{Enter}");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent('"components":[1,0,0]');
        await expect.element(box).toHaveDisplayValue(typed);
    });
});

describe("a colour", () => {
    const brand = { colorSpace: "oklch", components: [0.624, 0.181, 258], hex: "#3884f2" };
    const writtenOf = (screen: Awaited<ReturnType<typeof render>>) =>
        JSON.parse(screen.getByRole("status", { name: "written" }).element().textContent ?? "null");

    it("writes a component exactly as typed, and the hex the file has", async () => {
        const screen = await render(<Row type="color" start={brand} />);

        await screen.getByRole("textbox", { name: "base, C" }).fill("0.0134567");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent("0.0134567");
        expect(writtenOf(screen)).toMatchObject({
            colorSpace: "oklch",
            components: [0.624, 0.0134567, 258],
            hex: expect.stringMatching(/^#[0-9a-f]{6}$/),
        });
    });

    it("writes what a slider is moved to", async () => {
        const screen = await render(<Row type="color" start={brand} />);

        await screen.getByRole("slider", { name: "base, L" }).fill("0.9");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent("[0.9,0.181,258]");
    });

    it("converts to the colour space chosen, to four decimal places", async () => {
        const screen = await render(<Row type="color" start={brand} />);

        await screen
            .getByRole("combobox", { name: "base, colour space" })
            .selectOptions("display-p3");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent('"colorSpace":"display-p3"');
        for (const component of writtenOf(screen).components) {
            expect(String(component)).toMatch(/^-?\d+(\.\d{1,4})?$/);
        }
    });

    it("converts the colour you see when a box is left half typed", async () => {
        const screen = await render(<Row type="color" start={brand} />);

        await screen.getByRole("textbox", { name: "base, C" }).fill("");
        await screen.getByRole("combobox", { name: "base, colour space" }).selectOptions("oklab");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent('"colorSpace":"oklab"');
        const [lightness] = writtenOf(screen).components;
        expect(lightness).toBeCloseTo(0.624, 3);
    });

    it("writes none typed for a component", async () => {
        const screen = await render(<Row type="color" start={brand} />);

        await screen.getByRole("textbox", { name: "base, H" }).fill("none");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent('[0.624,0.181,"none"]');
    });

    it("says which gamut the colour is in, and when a switch reduced its chroma to fit", async () => {
        const vivid = { colorSpace: "oklch", components: [0.7, 0.28, 145] };
        const screen = await render(<Row type="color" start={vivid} />);
        await expect.element(screen.getByText("In Display P3")).toBeVisible();

        await screen.getByRole("combobox", { name: "base, colour space" }).selectOptions("srgb");

        await expect.element(screen.getByText("Chroma reduced to fit sRGB.")).toBeVisible();
        await expect.element(screen.getByText("In sRGB")).toBeVisible();
        for (const component of writtenOf(screen).components) {
            expect(component).toBeGreaterThanOrEqual(0);
            expect(component).toBeLessThanOrEqual(1);
        }
    });

    it("keeps a hex colour a hex colour, as typed", async () => {
        const screen = await render(<Row type="color" start="#26262f1a" />);

        await screen.getByRole("textbox", { name: "base" }).fill("#2a2a33cc");

        await expect
            .element(screen.getByRole("status", { name: "written" }))
            .toHaveTextContent('"#2a2a33cc"');
    });
});
