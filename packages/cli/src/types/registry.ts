export type Framework = "react" | "web-components" | "css-only";

export type ComponentChoice = Framework | "skip";

export type RegistryItemType = "component" | "cube" | "tokens";

export interface BaseFile {
    path: string;
    type: string;
}

export interface ComponentFile extends BaseFile {
    framework: Framework;
}

export interface RegistryItem {
    name: string;
    type: string;
    description?: string;
    frameworks?: string[];
    files: (ComponentFile | BaseFile)[];
    tokens?: Record<
        string,
        {
            type: string;
            mapping: string;
        }
    >;
    dependencies?: Partial<Record<Framework, string[]>>;
    registryDependencies?: Partial<Record<Framework, string[]>>;
    tokenDependencies?: string[];
}

export interface FileContentResponse {
    content: string;
}
