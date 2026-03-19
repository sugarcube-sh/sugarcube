/**
 * Available color palettes from the fluid starter kit
 */
export const PALETTES = {
  greys: ["neutral", "slate", "zinc", "gray", "stone"] as const,
  colors: [
    "red",
    "orange",
    "amber",
    "yellow",
    "lime",
    "green",
    "emerald",
    "teal",
    "cyan",
    "sky",
    "blue",
    "indigo",
    "violet",
    "purple",
    "fuchsia",
    "pink",
    "rose",
  ] as const,
};

export const ALL_PALETTES = [...PALETTES.greys, ...PALETTES.colors] as const;

export type GreyPalette = (typeof PALETTES.greys)[number];
export type ColorPalette = (typeof PALETTES.colors)[number];
export type Palette = (typeof ALL_PALETTES)[number];

/**
 * Scale steps available in each palette
 */
export const SCALE = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

export type ScaleStep = (typeof SCALE)[number];

/**
 * Default scale mappings for each family
 * Maps intensity (quiet/normal/loud) to scale steps
 */
export const DEFAULT_SCALES = {
  neutral: {
    fillQuiet: "50" as ScaleStep,
    fillNormal: "100" as ScaleStep,
    fillLoud: "800" as ScaleStep,
    borderQuiet: "100" as ScaleStep,
    borderNormal: "200" as ScaleStep,
    borderLoud: "300" as ScaleStep,
    onQuiet: "950" as ScaleStep,
    onNormal: "950" as ScaleStep,
    onLoud: "50" as ScaleStep,
  },
  accent: {
    fillQuiet: "50" as ScaleStep,
    fillNormal: "100" as ScaleStep,
    fillLoud: "600" as ScaleStep,
    borderQuiet: "100" as ScaleStep,
    borderNormal: "200" as ScaleStep,
    borderLoud: "300" as ScaleStep,
    onQuiet: "700" as ScaleStep,
    onNormal: "700" as ScaleStep,
    onLoud: "50" as ScaleStep,
  },
  // Status families all use the same scale pattern as accent
  status: {
    fillQuiet: "50" as ScaleStep,
    fillNormal: "100" as ScaleStep,
    fillLoud: "600" as ScaleStep,
    borderQuiet: "100" as ScaleStep,
    borderNormal: "200" as ScaleStep,
    borderLoud: "300" as ScaleStep,
    onQuiet: "700" as ScaleStep,
    onNormal: "700" as ScaleStep,
    onLoud: "50" as ScaleStep,
  },
} as const;

export type ScaleMapping = typeof DEFAULT_SCALES.neutral;

/**
 * Corner radius presets
 */
export const CORNER_PRESETS = {
  sharp: "none",
  subtle: "sm",
  rounded: "lg",
  pill: "full",
} as const;

export type CornerPreset = keyof typeof CORNER_PRESETS;

/**
 * Border width presets
 */
export const BORDER_WIDTH_PRESETS = {
  hairline: "hairline",
  thin: "thin",
  thick: "thick",
} as const;

export type BorderWidthPreset = keyof typeof BORDER_WIDTH_PRESETS;

/**
 * Available font families
 */
export const FONTS = {
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
} as const;

export type FontFamily = keyof typeof FONTS;

/**
 * Surface tokens that can be configured
 */
export const SURFACE_TOKENS = [
  "default",
  "raised",
  "lowered",
  "lowest",
] as const;

export type SurfaceToken = (typeof SURFACE_TOKENS)[number];

/**
 * Text tokens that can be configured
 */
export const TEXT_TOKENS = ["normal", "quiet", "quieter", "link"] as const;

export type TextToken = (typeof TEXT_TOKENS)[number];

/**
 * Status families
 */
export const STATUS_FAMILIES = [
  "success",
  "warning",
  "error",
  "info",
] as const;

export type StatusFamily = (typeof STATUS_FAMILIES)[number];

/**
 * Default palette assignments for each family
 */
export const DEFAULT_FAMILY_PALETTES = {
  neutral: "neutral" as Palette,
  accent: "pink" as Palette,
  success: "emerald" as Palette,
  warning: "amber" as Palette,
  error: "rose" as Palette,
  info: "blue" as Palette,
} as const;
