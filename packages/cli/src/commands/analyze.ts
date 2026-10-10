import { Command, Option } from "commander";
import { type Analysis, impact, tokenAt, unused } from "../analyze/answers.js";
import { impactJSON, unusedJSON } from "../analyze/json.js";
import { type System, systemOf } from "../analyze/system.js";
import {
    impactHeading,
    impactLines,
    impactSummary,
    shortfall,
    unusedLines,
    unusedSummary,
} from "../analyze/text.js";
import { type Uses, findUses } from "../analyze/uses.js";
import { type Built, build } from "../build.js";
import { CLIError } from "../cli-error.js";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { printProblems, whereOf } from "../problems.js";
import { printWarning } from "../prompts/box-with-badge.js";
import { intro, label, outro } from "../prompts/common.js";
import { log, rawLog } from "../prompts/log.js";

async function systemFor(plain: boolean): Promise<{ built: Built; system: System } | undefined> {
    const built = await build(await loadTokenConfigOrThrow("analyze"));
    const failed = printProblems(built.diagnostics, whereOf(built), {
        onlyErrors: true,
        whenFailed: ERROR_MESSAGES.NOTHING_ANALYSED(),
        ...(plain && { to: process.stderr }),
    });
    if (failed) {
        process.exitCode = 1;
        return undefined;
    }
    return { built, system: systemOf(built) };
}

async function usesFor(built: Built, asking: "unused" | "impact", plain: boolean): Promise<Uses> {
    const uses = await findUses(built);
    const warning = shortfall(uses, asking);
    if (warning) printWarning(warning, { plain });
    return uses;
}

const printJSON = (value: unknown) => console.log(JSON.stringify(value, null, 2));

const unusedCommand = new Command()
    .name("unused")
    .description("List tokens nothing in your CSS or markup uses, directly or through other tokens")
    .option("--all", "List every unused token path, one per line (for grep/piping)")
    .option("--json", "Output machine-readable JSON")
    .allowExcessArguments(false)
    .action(async (options: { json?: boolean; all?: boolean }) => {
        try {
            const plain = options.json === true || options.all === true;
            if (!plain) intro(label("Analyze"));

            const found = await systemFor(plain);
            if (!found) return;
            const uses = await usesFor(found.built, "unused", plain);
            const analysis: Analysis = { system: found.system, uses };
            const answer = unused(analysis);

            if (options.json) return printJSON(unusedJSON(answer, uses));
            if (options.all) {
                for (const path of answer.unused) rawLog(path);
                return;
            }
            if (answer.unused.length > 0) {
                log.message(unusedLines(answer, found.system.tokens.keys()));
            }
            outro(unusedSummary(answer, uses));
        } catch (error) {
            handleError(error);
        }
    });

const impactCommand = new Command()
    .name("impact")
    .description("Show everything affected by changing a token (dependent tokens and CSS/markup)")
    .argument("<token>", "Token path, e.g. color.pink.600")
    .addOption(new Option("--tree").hideHelp())
    .addOption(new Option("--brief").hideHelp())
    .option("--json", "Output machine-readable JSON")
    .action(async (path: string, options: { json?: boolean }) => {
        try {
            const plain = options.json === true;
            if (!plain) intro(label("Analyze"));

            const found = await systemFor(plain);
            if (!found) return;
            const token = tokenAt(found.system, path);
            if (token === "group") throw new CLIError(ERROR_MESSAGES.ANALYZE_GROUP_NOT_TOKEN(path));
            if (!token) throw new CLIError(ERROR_MESSAGES.ANALYZE_NO_TOKEN(path));
            const uses = await usesFor(found.built, "impact", plain);
            const answer = impact({ system: found.system, uses }, token);

            if (plain) return printJSON(impactJSON(answer));
            log.message(impactHeading(answer));
            const lines = impactLines(answer);
            if (lines.length > 0) log.message(lines);
            outro(impactSummary(answer));
        } catch (error) {
            handleError(error);
        }
    });

export const analyze = new Command()
    .name("analyze")
    .description("Report what's true about your token system (insight, not pass/fail)")
    .addCommand(unusedCommand)
    .addCommand(impactCommand);
