import { findPackageJSON } from "node:module";
import { dirname, join } from "node:path";

const packageDir = dirname(findPackageJSON("..", import.meta.url) as string);

export const BUILT_APP = join(packageDir, "dist/client");

export const BUILT_PAGE_SCRIPT = join(packageDir, "dist/page-script/page-script.mjs");
