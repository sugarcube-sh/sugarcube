import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repository = "https://github.com/design-tokens/community-group";
const version = "2025.10";
const here = import.meta.dirname;
const wanted = process.argv[2] ?? "main";
const clone = mkdtempSync(join(tmpdir(), "dtcg-test-suite-"));

const git = (...args) => execFileSync("git", ["-C", clone, ...args], { encoding: "utf8" }).trim();

try {
    execFileSync("git", [
        "clone",
        "--quiet",
        "--filter=blob:none",
        "--no-checkout",
        "--sparse",
        `${repository}.git`,
        clone,
    ]);
    git("sparse-checkout", "set", "test-suite");
    git("checkout", "--quiet", wanted);
    const commit = git("log", "-1", "--format=%H");
    const date = git("log", "-1", "--format=%cs");

    rmSync(join(here, version), { recursive: true, force: true });
    cpSync(join(clone, "test-suite", "tests", version), join(here, version), { recursive: true });
    writeFileSync(
        join(here, "UPSTREAM.md"),
        `# Where this copy comes from

\`${version}/\` is \`test-suite/tests/${version}\` from ${repository}, unchanged.

- Commit: [\`${commit.slice(0, 8)}\`](${repository}/tree/${commit}/test-suite), ${date}
- License: the W3C 3-clause BSD License, in \`LICENSE.md\`

To update it, run this from the repository's root, with a commit or \`main\`:

\`\`\`sh
node packages/dtcg/tests/conformance/refresh.mjs main
\`\`\`
`,
    );
    console.log(`${version}/ is now ${commit.slice(0, 8)} (${date})`);
} finally {
    rmSync(clone, { recursive: true, force: true });
}
