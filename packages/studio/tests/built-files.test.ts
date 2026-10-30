import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILT_APP, BUILT_PAGE_SCRIPT } from "../src/built-files";

describe("the files studio's hosts serve", () => {
    it("are where studio's build writes them", () => {
        expect({
            app: existsSync(join(BUILT_APP, "index.html")),
            pageScript: existsSync(BUILT_PAGE_SCRIPT),
        }).toStrictEqual({ app: true, pageScript: true });
    });
});
