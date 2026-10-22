import { setValue } from "@sugarcube-sh/dtcg-edit";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { plain } from "../../src/adapters/plain";
import { createStudio } from "../../src/controllers/studio";
import { Clashes } from "../../src/inspector/Clashes";
import { StudioContext } from "../../src/providers/studio-context";

const file = (s: number, m: number) =>
    JSON.stringify({ space: { $type: "number", s: { $value: s }, m: { $value: m } } });
const message = (text: string) => ({
    adapter: { name: "plain" as const, settings: {}, problems: [] },
    entry: "tokens.json",
    files: { "tokens.json": text },
});

describe("a clash's reason for refusing Keep yours", () => {
    it("goes once the clashes it was about are settled, and doesn't come back with the next", async () => {
        const studio = createStudio(message(file(1, 1)), (sent) =>
            plain(sent.name === "plain" ? sent.settings : {}),
        );
        const screen = await render(
            <StudioContext.Provider value={studio}>
                <Clashes />
            </StudioContext.Provider>,
        );

        studio.do(setValue(studio.state.tokens, "space.s", 2));
        studio.receive(message(file(3, 1)));
        studio.do(setValue(studio.state.tokens, "space.s", 4));
        await screen.getByRole("button", { name: "Keep yours" }).click();
        const items = () => screen.getByRole("list", { name: "Clashes" }).getByRole("listitem");
        await expect.poll(() => items().elements().length).toBe(2);

        await screen.getByRole("button", { name: "Keep theirs" }).click();
        studio.do(setValue(studio.state.tokens, "space.m", 2));
        studio.receive(message(file(4, 3)));

        await expect.element(screen.getByRole("button", { name: "Keep theirs" })).toBeVisible();
        expect(items().elements()).toHaveLength(1);
    });
});
