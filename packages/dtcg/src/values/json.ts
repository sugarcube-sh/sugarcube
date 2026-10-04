/**
 * Whether a JSON value is an object: not an array, not `null`, not a string or number. For reading
 * an extension, whose shape `dtcg` cannot know.
 *
 * @example
 * if (!isJsonObject(extension.fluid)) reader.report(["fluid"], "not-an-object", { name: "fluid" });
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
