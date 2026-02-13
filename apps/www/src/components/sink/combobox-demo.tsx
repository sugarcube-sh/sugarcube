"use client";

import { CheckIcon, ChevronDownIcon, ChevronsUpDown, PlusCircleIcon } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";
import { Button } from "@/registry/components/button/react/button";
import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/registry/components/command/react/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/registry/components/popover/react/popover";
import cn from "clsx";

const frameworks = [
    {
        value: "next.js",
        label: "Next.js",
    },
    {
        value: "sveltekit",
        label: "SvelteKit",
    },
    {
        value: "nuxt.js",
        label: "Nuxt.js",
    },
    {
        value: "remix",
        label: "Remix",
    },
    {
        value: "astro",
        label: "Astro",
    },
];

type Framework = (typeof frameworks)[number];

const users = [
    {
        id: "1",
        username: "shadcn",
    },
    {
        id: "2",
        username: "leerob",
    },
    {
        id: "3",
        username: "evilrabbit",
    },
] as const;

type User = (typeof users)[number];

const timezones = [
    {
        label: "Americas",
        timezones: [
            { value: "America/New_York", label: "(GMT-5) New York" },
            { value: "America/Los_Angeles", label: "(GMT-8) Los Angeles" },
            { value: "America/Chicago", label: "(GMT-6) Chicago" },
            { value: "America/Toronto", label: "(GMT-5) Toronto" },
            { value: "America/Vancouver", label: "(GMT-8) Vancouver" },
            { value: "America/Sao_Paulo", label: "(GMT-3) São Paulo" },
        ],
    },
    {
        label: "Europe",
        timezones: [
            { value: "Europe/London", label: "(GMT+0) London" },
            { value: "Europe/Paris", label: "(GMT+1) Paris" },
            { value: "Europe/Berlin", label: "(GMT+1) Berlin" },
            { value: "Europe/Rome", label: "(GMT+1) Rome" },
            { value: "Europe/Madrid", label: "(GMT+1) Madrid" },
            { value: "Europe/Amsterdam", label: "(GMT+1) Amsterdam" },
        ],
    },
    {
        label: "Asia/Pacific",
        timezones: [
            { value: "Asia/Tokyo", label: "(GMT+9) Tokyo" },
            { value: "Asia/Shanghai", label: "(GMT+8) Shanghai" },
            { value: "Asia/Singapore", label: "(GMT+8) Singapore" },
            { value: "Asia/Dubai", label: "(GMT+4) Dubai" },
            { value: "Australia/Sydney", label: "(GMT+11) Sydney" },
            { value: "Asia/Seoul", label: "(GMT+9) Seoul" },
        ],
    },
] as const;

type Timezone = (typeof timezones)[number];

export function ComboboxDemo() {
    return (
        <div className="cluster">
            <FrameworkCombobox frameworks={[...frameworks]} />
            <UserCombobox users={[...users]} selectedUserId={users[0].id} />
            <TimezoneCombobox
                timezones={[...timezones]}
                selectedTimezone={timezones[0].timezones[0]}
            />
            <ComboboxWithCheckbox frameworks={[...frameworks]} />
        </div>
    );
}

function FrameworkCombobox({ frameworks }: { frameworks: Framework[] }) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState("");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    data-appearance="outlined"
                    // biome-ignore lint/a11y/useSemanticElements: Custom combobox implementation
                    role="combobox"
                    aria-expanded={open}
                    className=""
                >
                    {value
                        ? frameworks.find((framework) => framework.value === value)?.label
                        : "Select framework..."}
                    <ChevronsUpDown className="" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="">
                <Command>
                    <CommandInput placeholder="Search framework..." />
                    <CommandList>
                        <CommandEmpty>No framework found.</CommandEmpty>
                        <CommandGroup>
                            {frameworks.map((framework) => (
                                <CommandItem
                                    key={framework.value}
                                    value={framework.value}
                                    onSelect={(currentValue) => {
                                        setValue(currentValue === value ? "" : currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    {framework.label}
                                    <CheckIcon
                                        className={cn(
                                            "ml-auto",
                                            value === framework.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function UserCombobox({
    users,
    selectedUserId,
}: {
    users: User[];
    selectedUserId: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState(selectedUserId);

    const selectedUser = React.useMemo(
        () => users.find((user) => user.id === value),
        [value, users]
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    // biome-ignore lint/a11y/useSemanticElements: Custom combobox implementation
                    role="combobox"
                    data-appearance="outlined"
                    aria-expanded={open}
                    className=""
                >
                    {selectedUser ? (
                        <div className="cluster">
                            <Avatar data-size="xs">
                                <AvatarImage
                                    src={`https://github.com/${selectedUser.username}.png`}
                                />
                                <AvatarFallback>{selectedUser.username[0]}</AvatarFallback>
                            </Avatar>
                            {selectedUser.username}
                        </div>
                    ) : (
                        "Select user..."
                    )}
                    <ChevronsUpDown />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="">
                <Command>
                    <CommandInput placeholder="Search user..." />
                    <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                            {users.map((user) => (
                                <CommandItem
                                    key={user.id}
                                    value={user.id}
                                    onSelect={(currentValue) => {
                                        setValue(currentValue === value ? "" : currentValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Avatar data-size="xs">
                                        <AvatarImage
                                            src={`https://github.com/${user.username}.png`}
                                        />
                                        <AvatarFallback>{user.username[0]}</AvatarFallback>
                                    </Avatar>
                                    {user.username}
                                    <CheckIcon
                                        className={cn(
                                            "ml-auto",
                                            value === user.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem>
                                <PlusCircleIcon />
                                Create user
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function TimezoneCombobox({
    timezones,
    selectedTimezone,
}: {
    timezones: Timezone[];
    selectedTimezone: Timezone["timezones"][number];
}) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState(selectedTimezone.value);

    const selectedGroup = React.useMemo(
        () => timezones.find((group) => group.timezones.find((tz) => tz.value === value)),
        [value, timezones]
    );

    const selectedTimezoneLabel = React.useMemo(
        () => selectedGroup?.timezones.find((tz) => tz.value === value)?.label,
        [value, selectedGroup]
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                asChild
                style={{ "--_popover-trigger-width": "18rem" } as React.CSSProperties}
            >
                <Button data-appearance="outlined" className="h-[48px]">
                    {selectedTimezone ? (
                        <div className="flex flex-col items-start gap-2xs">
                            <span className="text-xs text-quiet font-weight-normal">
                                {selectedGroup?.label}
                            </span>
                            <span>{selectedTimezoneLabel}</span>
                        </div>
                    ) : (
                        "Select timezone"
                    )}
                    <ChevronDownIcon className="text-quiet" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
                <Command>
                    <CommandInput placeholder="Search timezone..." />
                    <CommandList className="">
                        <CommandEmpty>No timezone found.</CommandEmpty>
                        {timezones.map((region) => (
                            <CommandGroup key={region.label} heading={region.label}>
                                {region.timezones.map((timezone) => (
                                    <CommandItem
                                        key={timezone.value}
                                        value={timezone.value}
                                        onSelect={(currentValue) => {
                                            setValue(
                                                currentValue as Timezone["timezones"][number]["value"]
                                            );
                                            setOpen(false);
                                        }}
                                    >
                                        {timezone.label}
                                        <CheckIcon
                                            className={cn(
                                                "ml-auto",
                                                value === timezone.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                            data-selected={value === timezone.value}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                        <CommandSeparator className="" />
                        <CommandGroup className="">
                            <CommandItem>
                                <PlusCircleIcon />
                                Create timezone
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function ComboboxWithCheckbox({ frameworks }: { frameworks: Framework[] }) {
    const [open, setOpen] = React.useState(false);
    const [selectedFrameworks, setSelectedFrameworks] = React.useState<Framework[]>([]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                asChild
                className="w-fit"
                style={{ minWidth: "18rem" } as React.CSSProperties}
            >
                <Button
                    data-appearance="outlined"
                    // biome-ignore lint/a11y/useSemanticElements: Custom combobox implementation
                    role="combobox"
                    aria-expanded={open}
                    className=""
                >
                    {selectedFrameworks.length > 0
                        ? selectedFrameworks.map((framework) => framework.label).join(", ")
                        : "Select frameworks (multi-select)..."}
                    <ChevronsUpDown className="" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px]" align="start">
                <Command>
                    <CommandInput placeholder="Search framework..." />
                    <CommandList>
                        <CommandEmpty>No framework found.</CommandEmpty>
                        <CommandGroup>
                            {frameworks.map((framework) => (
                                <CommandItem
                                    key={framework.value}
                                    value={framework.value}
                                    onSelect={(currentValue) => {
                                        setSelectedFrameworks(
                                            selectedFrameworks.some((f) => f.value === currentValue)
                                                ? selectedFrameworks.filter(
                                                      (f) => f.value !== currentValue
                                                  )
                                                : [...selectedFrameworks, framework]
                                        );
                                    }}
                                >
                                    <Checkbox
                                        checked={selectedFrameworks.some(
                                            (f) => f.value === framework.value
                                        )}
                                        onCheckedChange={(checked) => {
                                            setSelectedFrameworks(
                                                checked
                                                    ? [...selectedFrameworks, framework]
                                                    : selectedFrameworks.filter(
                                                          (f) => f.value !== framework.value
                                                      )
                                            );
                                        }}
                                    />
                                    <span>{framework.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
