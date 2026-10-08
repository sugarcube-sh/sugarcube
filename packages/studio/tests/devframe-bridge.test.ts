import { stripVTControlCharacters } from "node:util";
import type { DevframeNodeContext } from "devframe/types";
import { defineDiagnostics } from "devframe/utils/nostics";
import { afterEach, expect, it, vi } from "vitest";
import { createDevframeBridge } from "../src/server/devframe-bridge";

function devframeContext(): DevframeNodeContext {
    const registry: Record<string, unknown> = {};
    const diagnostics = {
        logger: new Proxy({}, { get: (_, code) => registry[String(code)] }),
        register: (definitions: Record<string, unknown>) => Object.assign(registry, definitions),
        defineDiagnostics,
    };
    return { diagnostics } as unknown as DevframeNodeContext;
}

afterEach(() => vi.restoreAllMocks());

it("prints a warning the way devframe reports one", () => {
    const printed = vi.spyOn(console, "warn").mockImplementation(() => {});

    createDevframeBridge(devframeContext()).warn("nothing to show");

    expect(printed).toHaveBeenCalledOnce();
    const shown = stripVTControlCharacters(String(printed.mock.calls[0]?.[0]));
    expect(shown).toContain("[studio] nothing to show");
});
