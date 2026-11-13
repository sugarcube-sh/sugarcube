import { Command, Option } from "commander";
import { type Analysis, findImpact, findUnused, findDefinitions } from "../analyze/answers.js";
import { toImpactJSON, toUnusedJSON } from "../analyze/json.js";
import {
    formatImpactHeading,
    formatImpactTree,
    formatImpactSummary,
    formatAnalyzeWarning,
    formatUnusedTable,
    formatUnusedSummary,
} from "../analyze/text.js";
import { type TokenUses, findUses } from "../analyze/uses.js";
import { type BuildResult, build } from "../build.js";
import { CLIError } from "../cli-error.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { handleError } from "../handle-error.js";
import { loadTokenConfigOrThrow } from "../load-config.js";
import { printProblems, getProblemContext } from "../problems.js";
import { printWarning } from "../prompts/box-with-badge.js";
import { intro, label, outro } from "../prompts/common.js";
import { log, rawLog } from "../prompts/log.js";

async function buildForAnalyze(isMachineOutput: boolean): Promise<BuildResult | undefined> {
    const built = await build(await loadTokenConfigOrThrow("analyze"));
    const failed = printProblems(built.diagnostics, getProblemContext(built), {
        onlyErrors: true,
        failureText: ErrorMessages.NOTHING_ANALYSED(),
        ...(isMachineOutput && { stream: process.stderr }),
    });
    if (failed) {
        process.exitCode = 1;
        return undefined;
    }
    return built;
}

async function findUsesAndWarn(
    built: BuildResult,
    asking: "unused" | "impact",
    plain: boolean,
): Promise<TokenUses> {
    const uses = await findUses(built);
    const warning = formatAnalyzeWarning(uses, asking);
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

            const built = await buildForAnalyze(plain);
            if (!built) return;
            const uses = await findUsesAndWarn(built, "unused", plain);
            const analysis: Analysis = { tokens: built.tokens, uses };
            const answer = findUnused(analysis);

            if (options.json) return printJSON(toUnusedJSON(answer, uses));
            if (options.all) {
                for (const path of answer.unused) rawLog(path);
                return;
            }
            if (answer.unused.length > 0) {
                log.message(formatUnusedTable(answer, built.tokens.getTokenPaths()));
            }
            outro(formatUnusedSummary(answer, uses));
        } catch (error) {
            handleError(error);
        }
    });

const impactCommand = new Command()
    .name("impact")
    .description("Show what changing a token affects")
    .argument("<token>", "Token path, e.g. color.pink.600")
    .addOption(new Option("--tree").hideHelp())
    .addOption(new Option("--brief").hideHelp())
    .option("--json", "Output machine-readable JSON")
    .action(async (path: string, options: { json?: boolean }) => {
        try {
            const plain = options.json === true;
            if (!plain) intro(label("Analyze"));

            const built = await buildForAnalyze(plain);
            if (!built) return;
            const written = findDefinitions(built.tokens, path);
            if (written === "group")
                throw new CLIError(ErrorMessages.ANALYZE_GROUP_NOT_TOKEN(path));
            if (!written) throw new CLIError(ErrorMessages.ANALYZE_NO_TOKEN(path));
            const uses = await findUsesAndWarn(built, "impact", plain);
            const answer = findImpact({ tokens: built.tokens, uses }, path, written);

            if (plain) return printJSON(toImpactJSON(answer));
            log.message(formatImpactHeading(answer));
            const lines = formatImpactTree(answer);
            if (lines.length > 0) log.message(lines);
            outro(formatImpactSummary(answer));
        } catch (error) {
            handleError(error);
        }
    });

export const analyze = new Command()
    .name("analyze")
    .description("Find unused tokens and what a change affects")
    .addCommand(unusedCommand)
    .addCommand(impactCommand);
