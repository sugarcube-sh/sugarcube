export const ErrorMessages = {
    LOAD: {
        NO_FILES_FOUND: (pattern: string) => `No files found matching pattern: ${pattern}.`,
        INVALID_JSON: (path: string, message: string) => `Invalid JSON in file ${path}: ${message}`,
        GLOB_ERROR: (pattern: string, error: string) =>
            `Error resolving glob pattern ${pattern}: ${error}`,
    },
    FLATTEN: {
        INVALID_TOKEN_NAME: (name: string) =>
            `Invalid token name "${name}": Token names cannot contain dots (.), curly braces ({,}), or other special characters`,
        MISSING_DOLLAR_PREFIX: (path: string) =>
            `Token at ${path} is using 'value' or 'type' without the required '$' prefix. Use '$value' and '$type' instead.`,
        INVALID_TOKEN_NESTING: (path: string) =>
            `Token at "${path}" cannot contain child tokens or groups. Only metadata properties (starting with $) are allowed.`,
        COMPOSITE_TOKEN_MISSING_TYPE: (path: string) =>
            `Composite token at '${path}' is missing the required "$type" property. Composite tokens (tokens with object values) must specify their type to define their structure.`,
        CONFLICT_TOKEN_VS_GROUP: (path: string) =>
            `Conflict at "${path}": token vs group. A token cannot be replaced by a group (or vice versa).`,
        CONFLICT_INCOMPATIBLE_TYPES: (expected: string, received: string, path: string) =>
            `Type conflict at "${path}": expected ${expected}, got ${received}`,
    },
    METADATA: {
        COLLECTION_ERROR: (message: string) => `Error collecting metadata: ${message}`,
        INVALID_EXTENSIONS: (path: string) =>
            `Invalid extensions at ${path}: expected object, got ${typeof path}`,
        INVALID_DESCRIPTION: (path: string) =>
            `Invalid description at ${path}: expected string, got ${typeof path}`,
    },
    VALIDATE: {
        MISSING_TYPE: (path: string) => `Token at '${path}' is missing the "$type" property`,
        UNKNOWN_TOKEN_TYPE: (type: string, path: string) =>
            `Unknown token type '${type}' at ${path}. Valid types are: color, dimension, fontFamily, fontWeight, duration, cubicBezier, strokeStyle, border, transition, shadow, gradient, typography`,
        INVALID_COLOR: (value: unknown, path: string) =>
            `Invalid color at ${path}: '${value}'. Color should be a valid hex value or W3C color object`,
        INVALID_DIMENSION: (value: unknown, path: string) =>
            `Invalid dimension at '${path}': ${value}. Dimensions should have a numeric value and unit, like { "value": 16, "unit": "px" }`,
        INVALID_DIMENSION_UNIT: (unit: unknown, path: string) =>
            `Invalid unit at ${path}': '${unit}'. Unit must be either "px" or "rem"`,
        INVALID_FONT_FAMILY: (value: unknown, path: string) =>
            `Invalid font family at '${path}': ${value}. Should be a string or array of strings, like "Arial" or ["Arial", "sans-serif"]`,
        INVALID_FONT_WEIGHT: (value: unknown, path: string) =>
            `Invalid font weight at '${path}': ${value}. Should be a number between 1-1000 or a keyword like "thin", "light", "normal", "bold"`,
        INVALID_DURATION: (value: unknown, path: string) =>
            `Invalid duration at '${path}': ${value}. Should be like { "value": 300, "unit": "ms" }`,
        INVALID_DURATION_UNIT: (unit: unknown, path: string) =>
            `Invalid unit at ${path}: "${unit}". Unit must be "ms" or "s"`,
        INVALID_CUBIC_BEZIER: (value: unknown, path: string) =>
            `Invalid cubic bezier at ${path}: "${value}". Should be an array of 4 numbers between 0 and 1`,
        INVALID_STROKE_STYLE: (value: unknown, path: string) =>
            `Invalid stroke style at ${path}: "${value}". Should be "solid", "dashed", "dotted", etc.`,
        INVALID_STROKE_LINE_CAP: (value: unknown, path: string) =>
            `Invalid line cap at ${path}: "${value}". Should be one of: round, butt, square`,
        INVALID_BORDER: (value: unknown, path: string) =>
            `Invalid border at ${path}: "${value}". Should have color, width, and style properties`,
        INVALID_SHADOW: (value: unknown, path: string) =>
            `Invalid shadow at ${path}: "${value}". Should have color, offsetX, offsetY properties (blur and spread are optional)`,
        INVALID_SHADOW_INSET: (value: unknown, path: string) =>
            `Invalid inset value at ${path}: "${value}". Should be true or false`,
        INVALID_TRANSITION: (value: unknown, path: string) =>
            `Invalid transition at ${path}: "${value}". Should have duration, delay, and timingFunction properties`,
        INVALID_GRADIENT: (value: unknown, path: string) =>
            `Invalid gradient at ${path}: "${value}". Should be an array of color stops with position values between 0 and 1`,
        INVALID_GRADIENT_STOP_POSITION: (value: unknown, path: string) =>
            `Invalid gradient stop position at ${path}: "${value}". Position must be between 0 and 1`,
        INVALID_TYPOGRAPHY: (value: unknown, path: string) =>
            `Invalid typography at ${path}: "${value}". Should have fontFamily and fontSize (fontWeight, letterSpacing, and lineHeight are optional)`,
        MISSING_REQUIRED_PROPERTY: (prop: string, path: string) =>
            `Missing required property '${prop}' at ${path}`,
        INVALID_NUMBER: (value: unknown, path: string) =>
            `Invalid number at ${path}: "${value}". Expected a number value`,
        INVALID_ARRAY: (value: unknown, path: string) =>
            `Invalid array at ${path}: "${value}". Expected an array value`,
        MISSING_FLUID_CONFIG: (path: string) =>
            `Missing fluid configuration. Token at ${path} requires fluid viewport settings.`,
        INVALID_FLUID_DIMENSION: (value: unknown, path: string) =>
            `Invalid fluid dimension at ${path}: "${value}". Fluid dimensions should have min and max values, like { "min": { "value": 16, "unit": "px" }, "max": { "value": 24, "unit": "px" } }`,

        INVALID_VIEWPORT_CONFIG: (value: unknown, path: string) =>
            `Invalid viewport configuration at ${path}: "${value}". Viewport config should have min and max dimension values`,

        MISMATCHED_UNITS: (unit1: unknown, unit2: unknown, path: string) =>
            `Mismatched units at ${path}: min uses '${unit1}', max uses '${unit2}'. Both values must use the same unit`,
        INVALID_FLUID_VALUE_RANGE: (path: string) =>
            `Invalid fluid value range at ${path}: min value must be less than max value`,
        INVALID_TOKEN_TYPE: (expected: string, received: string, path: string) =>
            `Invalid token type at ${path}: expected ${expected}, got ${received}`,
        INVALID_TYPE: (expected: string, value: unknown, path: string) =>
            `Expected ${expected}, received ${typeof value} at ${path}`,
        INVALID_ENUM_VALUE: (enumValues: unknown[], value: unknown, path: string) =>
            `Expected value to be one of [${enumValues.join(", ")}], but got ${String(
                value
            )} at ${path}`,
    },
    RESOLVE: {
        CIRCULAR_REFERENCE: (path: string, ref: string) =>
            `Circular reference detected: ${path} -> ${ref}`,
        REFERENCE_NOT_FOUND: (ref: string, path: string) =>
            `Reference not found: ${ref} in ${path}. Does ${ref} exist?`,
        TYPE_MISMATCH: (path: string) => `Type mismatch in ${path}`,
    },
    GENERATE: {
        INVALID_CSS_VALUE: (key: string, value: unknown) =>
            `Invalid CSS value for property '${key}': ${value}`,
        INVALID_VARIABLE_NAME: (path: string, name: string) =>
            `Invalid CSS variable name at '${path}': ${name}`,
    },
    CONFIG: {
        INVALID_JSON: (error: string) => `Invalid JSON in config file: ${error}`,
        INVALID_CONFIG: (path: string, message: string) =>
            `Invalid configuration at ${path}: ${message}`,
        DUPLICATE_FILENAMES: (filename: string, paths: string[]) =>
            `Duplicate filename "${filename}":\n${paths.map((p) => `  - ${p}`).join("\n")}`,
        FILE_NOT_FOUND: (path: string) =>
            path === "sugarcube.config.ts"
                ? "Cannot find sugarcube config file. Please ensure you have a valid sugarcube.config.ts file in your project root."
                : `Cannot find sugarcube config file at "${path}". Please check the path and file permissions.`,
        MULTIPLE_RESOLVERS_FOUND: (paths: string[]) =>
            `Multiple resolver files found:\n${paths.map((f) => `  - ${f}`).join("\n")}\n\nPlease specify which one to use:\n  1. Create sugarcube.config.ts with resolver field\n  2. Use --resolver flag (generate command only)`,
        NO_CONFIG_OR_RESOLVER: () =>
            "No configuration found. Either:\n  1. Run: npx @sugarcube-sh/cli init\n  2. Create a .resolver.json file\n  3. Create a sugarcube.config.ts file",
    },

    UTILITIES: {
        RESERVED_PREFIX: (prefix: string, tokenType: string) =>
            `Cannot use reserved prefix "${prefix}" for ${tokenType} token type. This prefix is reserved for default utility classes. Please use a custom prefix instead.`,

        DUPLICATE_CLASS_NAME: (className: string, paths: string[]) =>
            `Ambiguous utility class "${className}" would be generated from multiple token paths: ${paths.join(
                ", "
            )}. This would make it impossible to know which token value should be used when this class is applied in HTML. To fix this, configure one or more paths with custom prefixes to make the intent clear.`,

        INVALID_PROPERTY_MAPPING: (tokenType: string) =>
            `Invalid property mapping for ${tokenType} token type. When mapping multiple properties, each mapping must include a unique prefix to avoid class name collisions.`,

        DUPLICATE_PREFIX: (prefix: string, tokenType: string) =>
            `Duplicate prefix "${prefix}" found in property mappings for ${tokenType} token type. Each property mapping must have a unique prefix to avoid class name collisions.`,

        MISSING_SOURCE: (property: string) =>
            `Utility config for '${property}' must have a valid 'source' property`,

        INVALID_SOURCE_PATTERN: (property: string, source: string) =>
            `Utility config for '${property}' has invalid source pattern '${source}'. Only patterns ending with '.*' are supported (e.g., 'color.*', 'font.weight.*').`,

        INVALID_DIRECTIONS: (property: string) =>
            `Utility config for '${property}' must have 'directions' as an array`,

        INVALID_CONFIG_OBJECT: "utilitiesConfig must be an object",

        INVALID_TOKENS_OBJECT: "tokens must be an object",
    },

    RESOLVER: {
        FILE_NOT_FOUND: (path: string) =>
            `Cannot read resolver file at "${path}". Please check the path and file permissions.`,
        INVALID_JSON: (message: string) => `Invalid JSON in resolver file: ${message}`,
        INVALID_REFERENCE: (ref: string) =>
            `Invalid reference "${ref}". References must use format #/sets/<name> or #/modifiers/<name>.`,
        INVALID_SOURCE_REFERENCE: (ref: string) =>
            `Invalid source reference "${ref}". Sources can only reference sets (#/sets/<name>), not modifiers.`,
        UNDEFINED_SET: (name: string) =>
            `Reference to undefined set "${name}". Define it in the "sets" section first.`,
        UNDEFINED_MODIFIER: (name: string) =>
            `Reference to undefined modifier "${name}". Define it in the "modifiers" section first.`,
        CIRCULAR_REFERENCE: (ref: string) => `Circular reference detected at "${ref}".`,
        EXTERNAL_FILE_NOT_FOUND: (path: string) => `Referenced file not found: ${path}`,
        EXTERNAL_FILE_ERROR: (path: string, message: string) =>
            `Failed to load "${path}": ${message}`,
        INVALID_JSON_POINTER: (pointer: string, reason: string) =>
            `Invalid JSON pointer "${pointer}": ${reason}`,
        DUPLICATE_NAME: (name: string) => `Duplicate name "${name}" in resolutionOrder.`,
        MODIFIER_NEEDS_CONTEXTS: "Modifier must have at least one context defined.",
        MODIFIER_SINGLE_CONTEXT:
            "Modifier has only one context. Consider using a set instead, or add more contexts.",
        INVALID_DEFAULT: (name: string, contexts: string[]) =>
            `Default context "${name}" is not defined. Valid contexts: ${contexts.join(", ")}`,
        UNKNOWN_MODIFIER: (name: string) => `Unknown modifier "${name}".`,
        INVALID_CONTEXT: (context: string, modifier: string, valid: string[]) =>
            `Invalid context "${context}" for modifier "${modifier}". Valid contexts: ${valid.join(", ")}`,
        MISSING_REQUIRED_INPUT: (name: string) =>
            `Missing required input for modifier "${name}". No default value is defined.`,
        INVALID_INPUT_TYPE: (name: string) => `Input for modifier "${name}" must be a string.`,
        MALFORMED_REFERENCE: (key: string, value: string) =>
            `Malformed source reference: { "${key}": "${value}" }. Did you mean { "$ref": "${value}" }?`,
        RESOLVER_AS_TOKEN_SOURCE: (path: string) =>
            `File "${path}" is a resolver document, not a token file. Resolver documents (version: "2025.10") cannot be used as token sources. Did you mean to reference a specific token file instead?`,
    },
} as const;
