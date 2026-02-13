import type { RegistryItem } from "@/types";

export const components: RegistryItem[] = [
    {
        name: "accordion",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/accordion/react/accordion.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/accordion/react/accordion.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/accordion/css/accordion.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-accordion", "lucide-react", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "alert",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/alert/react/alert.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/alert/react/alert.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/alert/css/alert.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["clsx"],
        },
    },
    {
        name: "avatar",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/avatar/react/avatar.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/avatar/react/avatar.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/avatar/css/avatar.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-avatar", "lucide-react", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "badge",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/badge/react/badge.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/badge/react/badge.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/badge/css/badge.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "button",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/button/react/button.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/button/react/button.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/button/css/button.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-slot", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "card",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/card/react/card.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/card/react/card.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/card/css/card.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "checkbox",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/checkbox/react/checkbox.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/checkbox/react/checkbox.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/checkbox/css/checkbox.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-checkbox", "lucide-react"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "combobox",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/combobox/react/combobox.tsx",
                type: "tsx",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["lucide-react"],
        },
        registryDependencies: {
            "react": ["button", "popover", "command"],
        },
    },
    {
        name: "command",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/command/react/command.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/command/react/command.css",
                type: "css",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["clsx", "cmdk"],
        },
        registryDependencies: {
            "react": ["dialog"],
        },
    },
    {
        name: "dialog",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/dialog/react/dialog.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/dialog/react/dialog.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/dialog/css/dialog.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["clsx", "@radix-ui/react-dialog"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "dropdown-menu",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/dropdown-menu/react/dropdown-menu.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/dropdown-menu/react/dropdown-menu.css",
                type: "css",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-dropdown-menu", "lucide-react", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "input",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/input/react/input.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/input/react/input.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/input/css/input.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["react", "react-dom", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "label",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/label/react/label.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/label/react/label.css",
                type: "css",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["clsx", "@radix-ui/react-label"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "popover",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/popover/react/popover.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/popover/react/popover.css",
                type: "css",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-popover", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "radio-group",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/radio-group/react/radio-group.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/radio-group/react/radio-group.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/radio-group/css/radio-group.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-radio-group", "lucide-react", "clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "select",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/select/react/select.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/select/react/select.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/select/css/select.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["@radix-ui/react-select", "lucide-react"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "switch",
        type: "component",
        frameworks: ["react", "css-only"],
        files: [
            {
                path: "components/switch/react/switch.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/switch/react/switch.css",
                type: "css",
                framework: "react",
            },
            {
                path: "components/switch/css/switch.css",
                type: "css",
                framework: "css-only",
            },
        ],
        dependencies: {
            "react": ["react", "react-dom", "clsx", "@radix-ui/react-switch"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "tabs",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/tabs/react/tabs.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/tabs/react/tabs.css",
                type: "css",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["clsx", "@radix-ui/react-tabs"],
        },
        registryDependencies: {
            "react": [],
        },
    },
    {
        name: "textarea",
        type: "component",
        frameworks: ["react"],
        files: [
            {
                path: "components/textarea/react/textarea.tsx",
                type: "tsx",
                framework: "react",
            },
            {
                path: "components/textarea/react/textarea.css",
                type: "css",
                framework: "react",
            },
        ],
        dependencies: {
            "react": ["clsx"],
        },
        registryDependencies: {
            "react": [],
        },
    },
];
