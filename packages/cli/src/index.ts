#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { components } from "./commands/components.js";
import { cube } from "./commands/cube.js";
import { generate } from "./commands/generate.js";
import { init } from "./commands/init.js";
import { validate } from "./commands/validate.js";

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main() {
    const program = new Command()
        .name("sugarcube")
        .description("CLI for sugarcube")
        .version(packageJson.version, "-v, --version", "display the version number");

    program
        .addCommand(init)
        .addCommand(generate)
        .addCommand(validate)
        .addCommand(components)
        .addCommand(cube);

    program.parse();
}

main();
