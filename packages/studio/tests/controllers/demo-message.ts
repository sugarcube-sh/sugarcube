import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type InternalConfig, fillDefaults } from "@sugarcube-sh/core";
import type { AnyDiagnostic } from "@sugarcube-sh/core/client";
import { adapterFor } from "../../src/adapters";
import type { PlainSettings } from "../../src/adapters/plain";
import { createStudio } from "../../src/controllers/studio";
import type { StudioMessage } from "../../src/protocol";
import { PLAIN_ENTRY, plainFiles } from "../adapters/plain-demo";

const DEMO = join(__dirname, "../../demo");

export const ENTRY = "tokens.resolver.json";

export function demoFiles(): Record<string, string> {
    return Object.fromEntries(
        readdirSync(DEMO)
            .filter((name) => name.endsWith(".json"))
            .map((name) => [name, readFileSync(join(DEMO, name), "utf8")]),
    );
}

export function asSent(
    config: Parameters<typeof fillDefaults>[0] = { resolver: ENTRY },
): InternalConfig {
    return JSON.parse(JSON.stringify(fillDefaults(config)));
}

export function sugarcubeSent({
    config = asSent(),
    problems = [],
}: {
    config?: InternalConfig;
    problems?: readonly AnyDiagnostic[];
} = {}): StudioMessage["adapter"] {
    return { name: "sugarcube", settings: config, problems };
}

export function demoMessage(change: Partial<StudioMessage> = {}): StudioMessage {
    return { adapter: sugarcubeSent(), entryFile: ENTRY, files: demoFiles(), ...change };
}

export function plainMessage(settings: PlainSettings = {}): StudioMessage {
    return {
        adapter: { name: "plain", settings, problems: [] },
        entryFile: PLAIN_ENTRY,
        files: plainFiles(),
    };
}

export function withFile(file: string, text: string, message = demoMessage()): StudioMessage {
    return { ...message, files: { ...message.files, [file]: text } };
}

export function sugarcubeSettings({ adapter }: StudioMessage): InternalConfig {
    if (adapter.name !== "sugarcube") throw new Error(`sent ${adapter.name}'s adapter`);
    return adapter.settings;
}

export function studioOn(message: StudioMessage = demoMessage()) {
    return createStudio(message, adapterFor);
}

export const configProblem: AnyDiagnostic = {
    kind: "invalid-config",
    severity: "error",
    message: "`variables.prefix` must be a string",
    docsUrl: "https://sugarcube.sh/errors/invalid-config",
    detail: {
        reason: "wrong-type",
        setting: "variables.prefix",
        expected: ["string"],
        received: "number",
    },
};
