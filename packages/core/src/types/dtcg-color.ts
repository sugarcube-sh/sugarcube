export type DTCGColorSpace = "oklch" | "display-p3" | "srgb" | "hsl";

export type DTCGColorComponent = number | "none";

export interface DTCGColorValue {
    colorSpace: DTCGColorSpace;
    components: [DTCGColorComponent, DTCGColorComponent, DTCGColorComponent];
    alpha?: number;
    hex?: string;
}
