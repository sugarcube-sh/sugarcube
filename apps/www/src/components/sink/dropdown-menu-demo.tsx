"use client";

import {
    BadgeCheckIcon,
    BellIcon,
    ChevronsUpDownIcon,
    CreditCardIcon,
    LogOut,
    LogOutIcon,
    MoreHorizontalIcon,
    PencilIcon,
    Settings2Icon,
    ShareIcon,
    SparklesIcon,
    TrashIcon,
    UserIcon,
} from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";
import { Button } from "@/registry/components/button/react/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/registry/components/dropdown-menu/react/dropdown-menu";

export function DropdownMenuDemo() {
    return (
        <div className="cluster">
            <DropdownMenuSimple />
            <DropdownMenuCheckboxes />
            <DropdownMenuRadioGroupDemo />
            <DropdownMenuWithAvatar />
            <DropdownMenuAvatarOnly />
            <DropdownMenuIconColor />
        </div>
    );
}

function DropdownMenuSimple() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button data-appearance="outlined">Open</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        Profile
                        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        Billing
                        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        Settings
                        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        Keyboard shortcuts
                        <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>Team</DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem>Email</DropdownMenuItem>
                                <DropdownMenuItem>Message</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>More...</DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuItem>
                        New Team
                        <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>GitHub</DropdownMenuItem>
                <DropdownMenuItem>Support</DropdownMenuItem>
                <DropdownMenuItem disabled>API</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    Log out
                    <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DropdownMenuCheckboxes() {
    const [showStatusBar, setShowStatusBar] = React.useState(true);
    const [showActivityBar, setShowActivityBar] = React.useState(false);
    const [showPanel, setShowPanel] = React.useState(false);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button data-appearance="outlined">Checkboxes</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem>
                        <UserIcon /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CreditCardIcon /> Billing
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Settings2Icon /> Settings
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                        checked={showStatusBar}
                        onCheckedChange={setShowStatusBar}
                    >
                        Status Bar
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={showActivityBar}
                        onCheckedChange={setShowActivityBar}
                        disabled
                    >
                        Activity Bar
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
                        Panel
                    </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <LogOutIcon /> Sign Out
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DropdownMenuRadioGroupDemo() {
    const [position, setPosition] = React.useState("bottom");

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button data-appearance="outlined">Radio Group</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel inset>Panel Position</DropdownMenuLabel>
                <DropdownMenuGroup>
                    <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
                        <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="right" disabled>
                            Right
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DropdownMenuWithAvatar() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    data-appearance="outlined"
                    style={{ "--form-control-height": "3rem" } as React.CSSProperties}
                >
                    <Avatar data-size="sm">
                        <AvatarImage
                            src="https://github.com/mark-tomlinson-dev.png"
                            alt="avatar of Mark Tomlinson"
                        />
                        <AvatarFallback>MT</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start gap-3xs">
                        <span className="tracking-tight truncate font-weight-medium">
                            Mark Tomlinson
                        </span>
                        <span className="truncate text-quiet text-xs">mark@example.com</span>
                    </div>
                    <ChevronsUpDownIcon className="text-quiet ml-auto" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[284px]" align="start">
                <DropdownMenuLabel>
                    <div className="flex items-center gap-2 text-left text-sm">
                        <Avatar data-size="sm">
                            <AvatarImage
                                src="https://github.com/mark-tomlinson-dev.png"
                                alt="avatar of Mark Tomlinson"
                            />
                            <AvatarFallback>MT</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="tracking-tight truncate font-weight-semibold">
                                Mark Tomlinson
                            </span>
                            <span className="truncate text-quiet text-xs">mark@example.com</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <SparklesIcon />
                        Upgrade to Pro
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <BadgeCheckIcon />
                        Account
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CreditCardIcon />
                        Billing
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <BellIcon />
                        Notifications
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <LogOut />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DropdownMenuAvatarOnly() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    data-appearance="ghost"
                    className=""
                    style={
                        {
                            "border-radius": "var(--radius-full)",
                            "padding": "0",
                            "outline": "none",
                        } as React.CSSProperties
                    }
                >
                    <Avatar data-size="sm">
                        <AvatarImage
                            src="https://github.com/mark-tomlinson-dev.png"
                            alt="avatar of Mark Tomlinson"
                        />
                        <AvatarFallback>MT</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuLabel className="">
                    <div className="flex items-center gap-2xs">
                        <Avatar className="avatar-lg">
                            <AvatarImage
                                src="https://github.com/mark-tomlinson-dev.png"
                                alt="avatar of Mark Tomlinson"
                            />
                            <AvatarFallback>MT</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start">
                            <span className="font-weight-medium">Mark Tomlinson</span>
                            <span className="text-quiet text-sm">mark@example.com</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <SparklesIcon />
                        Upgrade to Pro
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <BadgeCheckIcon />
                        Account
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CreditCardIcon />
                        Billing
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <BellIcon />
                        Notifications
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <LogOut />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DropdownMenuIconColor() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button data-appearance="ghost">
                    <MoreHorizontalIcon />
                    <span className="visually-hidden">Toggle menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuGroup className="">
                    <DropdownMenuItem>
                        <PencilIcon />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <ShareIcon />
                        Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-variant="error">
                        <TrashIcon />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
