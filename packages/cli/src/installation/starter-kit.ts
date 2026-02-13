import { findResolverDocument } from "@sugarcube-sh/core";
import { ERROR_MESSAGES } from "../constants/error-messages.js";
import { writeTokenFiles } from "../fs/write-token-files.js";
import { loadAndResolveTokensForCLI } from "../pipelines/load-and-resolve-for-cli.js";
import { prepareStarterKitForInstall } from "../starter-kit/prepare-for-install.js";
import { CLIError, type InitContext } from "../types/index.js";

export async function installFromStarterKit(ctx: InitContext): Promise<void> {
    const starterKitResult = await prepareStarterKitForInstall(
        ctx.starterKit ?? "",
        ctx.tokensDir,
        ctx.config
    );

    const createdFiles = await writeTokenFiles(starterKitResult.tokenFiles, ctx.tokensDir);

    const discovery = await findResolverDocument(ctx.tokensDir);
    if (discovery.found === "none") {
        throw new CLIError(ERROR_MESSAGES.RESOLVER_NOT_FOUND(ctx.tokensDir));
    }
    if (discovery.found === "multiple") {
        throw new CLIError(ERROR_MESSAGES.RESOLVER_MULTIPLE_FOUND(discovery.paths));
    }

    const configWithResolver = {
        ...ctx.config,
        resolver: discovery.path,
    };

    const { trees, resolved } = await loadAndResolveTokensForCLI(configWithResolver);

    ctx.setupResult = {
        config: configWithResolver,
        createdTokenPaths: starterKitResult.createdTokenPaths,
        trees,
        resolved,
        tokenFiles: starterKitResult.tokenFiles,
        tokensDir: starterKitResult.tokensDir,
    };
    ctx.createdFiles.push(...createdFiles);

    ctx.config = configWithResolver;
    ctx.sugarcubeConfig = { ...ctx.sugarcubeConfig, resolver: discovery.path };
}
