import type { RegistryItem } from "../types";
import { components } from "./components";
import { cube } from "./cube";
import { tokens } from "./tokens";

export const registry: RegistryItem[] = [...components, ...cube, ...tokens];
