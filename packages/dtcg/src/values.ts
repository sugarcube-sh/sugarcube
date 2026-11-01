export { colorSpaces, type ColorComponentRange } from "./values/color-spaces.js";
export { dimensionUnits, durationUnits } from "./values/units.js";
export {
    type FontWeightKeyword,
    type LineCap,
    fontWeightKeywords,
    lineCaps,
    strokeStyleKeywords,
} from "./values/keywords.js";
export { tokenTypes } from "./values/token-types.js";
export { parseValue } from "./values/parse-value.js";
export { toJsonPointer, parseReference, referenceText } from "./values/references.js";
export {
    type ExtensionReader,
    type ExtensionResult,
    createExtensionReader,
} from "./values/extension-reader.js";
export { isJsonObject } from "./values/json.js";
export { compositeParts } from "./values/composite-parts.js";
export { type WrittenColor, writtenColor } from "./values/written-color.js";
