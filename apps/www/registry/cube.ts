import type { RegistryItem } from "../types";

export const cube: RegistryItem[] = [
    {
        name: "blocks",
        type: "cube",
        files: [
            {
                path: "styles/blocks/prose.css",
                type: "css",
            },
        ],
    },
    {
        name: "compositions",
        type: "cube",
        files: [
            {
                path: "styles/compositions/cluster.css",
                type: "css",
            },
            {
                path: "styles/compositions/grid.css",
                type: "css",
            },
            {
                path: "styles/compositions/flow.css",
                type: "css",
            },
            {
                path: "styles/compositions/repel.css",
                type: "css",
            },
            {
                path: "styles/compositions/sidebar.css",
                type: "css",
            },
            {
                path: "styles/compositions/switcher.css",
                type: "css",
            },
            {
                path: "styles/compositions/wrapper.css",
                type: "css",
            },
        ],
    },
    {
        name: "utilities",
        type: "cube",
        files: [
            {
                path: "styles/utilities/region.css",
                type: "css",
            },
            {
                path: "styles/utilities/visually-hidden.css",
                type: "css",
            },
        ],
    },
    {
        name: "global",
        type: "cube",
        files: [
            {
                path: "styles/global/global.css",
                type: "css",
            },
        ],
    },
];
