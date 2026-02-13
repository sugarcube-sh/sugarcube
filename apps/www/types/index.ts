export type RegistryItemType = "component" | "cube" | "tokens" | "global-styles";

export type Framework = "react" | "css-only";

export interface RegistryItem {
    name: string;
    type: RegistryItemType;
    frameworks?: Framework[];
    files: Array<{
        path: string;
        type: string;
        framework?: Framework;
        mightConflictWithStarterKit?: boolean;
    }>;
    registryDependencies?: {
        react?: string[];
        "css-only"?: string[];
    };
    dependencies?: {
        react?: string[];
        "css-only"?: string[];
    };
}
