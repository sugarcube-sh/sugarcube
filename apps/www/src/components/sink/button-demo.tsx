import { ArrowRightIcon, Loader2Icon, SendIcon } from "lucide-react";

import { Button } from "@/registry/components/button/react/button";

export function ButtonDemo() {
    return (
        <div className="flow">
            <div className="cluster gutter-2xs">
                <Button>Default</Button>
                <Button data-variant="accent">Accent</Button>
                <Button data-variant="neutral">Neutral</Button>
                <Button data-variant="error">Error</Button>
                <Button data-variant="info">Info</Button>
                <Button data-variant="success">Success</Button>
                <Button data-variant="warning">Warning</Button>
                <Button>
                    <SendIcon /> Send
                </Button>
                <Button>
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled>
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button className="button-sm">Default</Button>
                <Button data-variant="accent" className="button-sm">
                    Accent
                </Button>
                <Button data-variant="neutral" className="button-sm">
                    Neutral
                </Button>
                <Button data-variant="error" className="button-sm">
                    Error
                </Button>
                <Button data-variant="info" className="button-sm">
                    Info
                </Button>
                <Button data-variant="success" className="button-sm">
                    Success
                </Button>
                <Button data-variant="warning" className="button-sm">
                    Warning
                </Button>
                <Button className="button-sm">
                    <SendIcon /> Send
                </Button>
                <Button className="button-sm">
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled className="button-sm">
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button className="button-lg">Default</Button>
                <Button data-variant="accent" className="button-lg">
                    Accent
                </Button>
                <Button data-variant="neutral" className="button-lg">
                    Neutral
                </Button>
                <Button data-variant="error" className="button-lg">
                    Error
                </Button>
                <Button data-variant="info" className="button-lg">
                    Info
                </Button>
                <Button data-variant="success" className="button-lg">
                    Success
                </Button>
                <Button data-variant="warning" className="button-lg">
                    Warning
                </Button>
                <Button className="button-lg">
                    <SendIcon /> Send
                </Button>
                <Button className="button-lg">
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled className="button-lg">
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div>
            {/* <div className="cluster gutter-2xs">
                <Button className="button-classic">Default</Button>
                <Button className="button-primary button-classic">Primary</Button>
                <Button className="button-secondary button-classic">Secondary</Button>
                <Button className="button-neutral button-classic">Neutral</Button>
                <Button className="button-accent button-classic">Accent</Button>
                <Button className="button-error button-classic">Error</Button>
                <Button className="button-info button-classic">Info</Button>
                <Button className="button-success button-classic">Success</Button>
                <Button className="button-warning button-classic">Warning</Button>
                <Button className="button-classic">
                    <SendIcon /> Send
                </Button>
                <Button className="button-classic">
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled className="button-classic">
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div> */}
            <div className="cluster gutter-2xs">
                <Button data-appearance="soft">Default</Button>
                <Button data-variant="accent" data-appearance="soft">
                    Accent
                </Button>
                <Button data-variant="neutral" data-appearance="soft">
                    Neutral
                </Button>
                <Button data-variant="error" data-appearance="soft">
                    Error
                </Button>
                <Button data-variant="info" data-appearance="soft">
                    Info
                </Button>
                <Button data-variant="success" data-appearance="soft">
                    Success
                </Button>
                <Button data-variant="warning" data-appearance="soft">
                    Warning
                </Button>
                <Button data-appearance="soft">
                    <SendIcon /> Send
                </Button>
                <Button data-appearance="soft">
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled data-appearance="soft">
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-appearance="soft-outlined">Default</Button>
                <Button data-variant="accent" data-appearance="soft-outlined">
                    Accent
                </Button>
                <Button data-variant="neutral" data-appearance="soft-outlined">
                    Neutral
                </Button>
                <Button data-variant="error" data-appearance="soft-outlined">
                    Error
                </Button>
                <Button data-variant="info" data-appearance="soft-outlined">
                    Info
                </Button>
                <Button data-variant="success" data-appearance="soft-outlined">
                    <SendIcon /> Send
                </Button>
                <Button data-appearance="soft-outlined">
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled data-appearance="soft-outlined">
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-appearance="outlined">Default</Button>
                <Button className="button-primary button-outline">Primary</Button>
                <Button data-variant="neutral" data-appearance="outlined">
                    Neutral
                </Button>
                <Button data-variant="accent" data-appearance="outlined">
                    Accent
                </Button>
                <Button data-variant="error" data-appearance="outlined">
                    Error
                </Button>
                <Button data-variant="info" data-appearance="outlined">
                    Info
                </Button>
                <Button data-variant="success" data-appearance="outlined">
                    <SendIcon /> Send
                </Button>
                <Button data-appearance="outlined">
                    Learn More <ArrowRightIcon />
                </Button>
                <Button disabled data-appearance="outlined">
                    <Loader2Icon className="animate-spin" />
                    Please wait
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-appearance="ghost">Ghost</Button>
                {/* TODO: This should be an anchor element with a link appearance? */}
                {/* <Button data-appearance="link">Link</Button> */}
            </div>
            <div className="cluster gutter-2xs">
                <Button data-appearance="outlined" className="is-icon-only">
                    <ArrowRightIcon />
                </Button>
                <Button className="is-icon-only">
                    <SendIcon />
                </Button>
                <Button data-appearance="soft" className="is-icon-only">
                    <ArrowRightIcon />
                </Button>
                <Button data-appearance="soft-outlined" className="is-icon-only">
                    <ArrowRightIcon />
                </Button>
                <Button data-appearance="ghost" className="is-icon-only">
                    <ArrowRightIcon />
                </Button>
            </div>
        </div>
    );
}
