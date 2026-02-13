import { promises as fs } from "node:fs";
import path from "node:path";
import { registry } from "@/registry";

function getFrameworkFromPath(filePath: string): "react" | "css-only" | null {
    if (filePath.includes("/react/")) {
        return "react";
    }
    if (filePath.includes("/css/")) {
        return "css-only";
    }
    const ext = path.extname(filePath);
    if (ext === ".tsx") {
        return "react";
    }
    return null;
}

async function build() {
    try {
        const publicDir = path.join(process.cwd(), "public/r");

        // Clean the public/r directory before rebuilding to remove stale files
        await fs.rm(publicDir, { recursive: true, force: true });
        await fs.mkdir(publicDir, { recursive: true });

        await fs.writeFile(
            path.join(publicDir, "index.json"),
            JSON.stringify(registry, null, 2),
            "utf-8"
        );

        for (const item of registry) {
            for (const file of item.files) {
                const sourceFile = path.join(process.cwd(), "registry", file.path);
                const targetDir = path.join(publicDir, path.dirname(file.path));

                await fs.mkdir(targetDir, { recursive: true });
                const content = await fs.readFile(sourceFile, "utf-8");

                const framework = getFrameworkFromPath(file.path);

                // Only include dependencies for the matching framework
                const frameworkDependencies = framework
                    ? {
                          [framework]: item.dependencies?.[framework] || [],
                          ...(framework === "react" ? { "css-only": [] } : { react: [] }),
                      }
                    : item.dependencies || {};

                const frameworkRegistryDependencies = framework
                    ? {
                          [framework]: item.registryDependencies?.[framework] || [],
                          ...(framework === "react" ? { "css-only": [] } : { react: [] }),
                      }
                    : item.registryDependencies || {};

                await fs.writeFile(
                    path.join(publicDir, `${file.path}.json`),
                    JSON.stringify(
                        {
                            name: item.name,
                            type: item.type,
                            path: file.path,
                            content: content,
                            frameworks: item.frameworks || [],
                            dependencies: frameworkDependencies || [],
                            registryDependencies: frameworkRegistryDependencies || [],
                        },
                        null,
                        2
                    ),
                    "utf-8"
                );
            }
        }

        console.log("✓ Registry built successfully");
    } catch (error) {
        console.error("Error building registry:", error);
        process.exit(1);
    }
}

build();
