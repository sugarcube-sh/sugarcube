import { describe, expect, it } from "vitest";
import { buildGroupView } from "../src/mvp/group-view";
import { baseContext, buildTokenRow } from "../src/mvp/token-view";
import { writeField } from "../src/mvp/value-field";
import { fileNamed, wired } from "./text-sources";

/**
 * The fixture set has two contexts. `color.text.*` is overridden in dark.json;
 * `radius.*` is authored once and read by both.
 */
function setup() {
    const { base, tokens, diff, stop } = wired();

    const view = (group: string) => {
        const index = tokens.getPathIndex();
        const state = tokens.store.getState();
        const built = buildGroupView(index, state.resolved, group, baseContext(index));
        if (!built) throw new Error(`no view for ${group}`);
        return built;
    };

    const commit = (group: string, name: string, text: string) => {
        const index = tokens.getPathIndex();
        const row = view(group).tokens.find((token) => token.name === name);
        if (!row) throw new Error(`no row named ${name}`);

        const next = writeField(row.type, row.value, text);
        if (next === undefined) return false;

        const overridden = new Set(row.overrides.map((override) => override.context));
        tokens.store.getState().setTokens(
            index
                .entriesFor(row.handle)
                .filter((entry) => !overridden.has(entry.context))
                .map((entry) => ({ path: row.handle, value: next, context: entry.context })),
        );
        return true;
    };

    const commitOverride = (handle: string, context: string, text: string) => {
        const index = tokens.getPathIndex();
        const row = buildTokenRow(
            index,
            tokens.store.getState().resolved,
            handle,
            baseContext(index),
        );
        if (!row) throw new Error(`no token at ${handle}`);

        const override = row.overrides.find((entry) => entry.context === context);
        if (!override) throw new Error(`${handle} has no override in ${context}`);

        const next = writeField(row.type, override.value, text);
        if (next === undefined) return false;

        tokens.store.getState().setToken(row.handle, next, context);
        return true;
    };

    const read = (context: string, path: string) =>
        tokens.getPathIndex().readValue(tokens.store.getState().resolved, path, context);

    return {
        base,
        view,
        commit,
        commitOverride,
        read,
        pending: () => diff.store.getState().entries,
        stop,
    };
}

describe("editing a value from the group page", () => {
    it("puts one entry in the change bar", () => {
        const studio = setup();

        expect(studio.pending()).toHaveLength(0);
        expect(studio.commit("color.text", "brand", "{color.brand.800}")).toBe(true);

        const entries = studio.pending();
        expect(entries).toHaveLength(1);
        expect(entries[0]?.path).toBe("color.text.brand");
        expect(entries[0]?.to.$value).toBe("{color.brand.800}");
        expect(entries[0]?.sourcePath).toBe(fileNamed(studio.base, "color.json"));

        studio.stop();
    });

    it("leaves a context that declares its own override alone", () => {
        const studio = setup();

        studio.commit("color.text", "brand", "{color.brand.800}");

        expect(studio.read("perm:0", "color.text.brand")).toBe("{color.brand.800}");
        expect(studio.read("perm:1", "color.text.brand")).toBe("{color.brand.300}");
        expect(studio.pending()[0]?.contexts).toEqual(["perm:0"]);

        studio.stop();
    });

    it("carries the edit into every context that draws from the base file", () => {
        const studio = setup();

        expect(studio.commit("radius", "md", "8px")).toBe(true);

        expect(studio.read("perm:0", "radius.md")).toEqual({ value: 8, unit: "px" });
        expect(studio.read("perm:1", "radius.md")).toEqual({ value: 8, unit: "px" });
        expect(studio.pending()).toHaveLength(1);
        expect(studio.pending()[0]?.contexts).toEqual([]);

        studio.stop();
    });

    it("refuses text the shape cannot hold, and changes nothing", () => {
        const studio = setup();

        expect(studio.commit("radius", "md", "roomy")).toBe(false);
        expect(studio.read("perm:0", "radius.md")).toEqual({ value: 0.25, unit: "rem" });
        expect(studio.pending()).toHaveLength(0);

        studio.stop();
    });

    it("shows the new value the next time the page reads", () => {
        const studio = setup();

        studio.commit("color.text", "brand", "{color.brand.800}");

        const row = studio.view("color.text").tokens.find((token) => token.name === "brand");
        expect(row?.value).toBe("{color.brand.800}");
        expect(row?.overrides).toEqual([
            {
                context: "perm:1",
                sourcePath: fileNamed(studio.base, "dark.json"),
                value: "{color.brand.300}",
            },
        ]);

        studio.stop();
    });

    it("edits an override in its own context only", () => {
        const studio = setup();

        expect(studio.commitOverride("color.text.brand", "perm:1", "{color.brand.200}")).toBe(true);

        expect(studio.read("perm:1", "color.text.brand")).toBe("{color.brand.200}");
        expect(studio.read("perm:0", "color.text.brand")).toBe("{color.brand.700}");
        expect(studio.pending()[0]?.contexts).toEqual(["perm:1"]);

        studio.stop();
    });
});
