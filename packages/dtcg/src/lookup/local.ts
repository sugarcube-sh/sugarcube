import type { LocalGroup, LocalToken } from "../model/definition.js";
import type { JsonValue } from "../model/json.js";
import { readProperty } from "../read/merge/spec-keys.js";
import { isJsonObject } from "../values/json.js";
import { getReferencePath, parseReference } from "../values/references.js";
import { isTokenType } from "../values/token-types.js";

export function readLocal(json: JsonValue): LocalToken & LocalGroup {
    if (!isJsonObject(json)) return {};
    const type = readProperty("$type", json.$type);
    const description = readProperty("$description", json.$description);
    const deprecated = readProperty("$deprecated", json.$deprecated);
    const extensions = readProperty("$extensions", json.$extensions);
    const extended = parseReference(json.$extends);
    const extendsPath = extended && getReferencePath(extended);
    return {
        ...("$value" in json && { value: json.$value as JsonValue }),
        ...(type !== undefined && isTokenType(type) && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions !== undefined && { extensions }),
        ...(extendsPath !== undefined && { extends: extendsPath }),
    };
}
