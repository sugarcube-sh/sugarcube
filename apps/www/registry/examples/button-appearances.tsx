import { Button } from "@/registry/components/button/react/button";

export function ButtonAppearances() {
    return (
        <div className="flow">
            <div className="cluster gutter-2xs">
                <Button>Solid</Button>
                <Button data-appearance="soft">Soft</Button>
                <Button data-appearance="soft-outlined">Soft Outlined</Button>
                <Button data-appearance="outlined">Outlined</Button>
                <Button data-appearance="ghost">Ghost</Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-variant="accent">Solid</Button>
                <Button data-variant="accent" data-appearance="soft">
                    Soft
                </Button>
                <Button data-variant="accent" data-appearance="soft-outlined">
                    Soft Outlined
                </Button>
                <Button data-variant="accent" data-appearance="outlined">
                    Outlined
                </Button>
                <Button data-variant="accent" data-appearance="ghost">
                    Ghost
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-variant="info">Solid</Button>
                <Button data-variant="info" data-appearance="soft">
                    Soft
                </Button>
                <Button data-variant="info" data-appearance="soft-outlined">
                    Soft Outlined
                </Button>
                <Button data-variant="info" data-appearance="outlined">
                    Outlined
                </Button>
                <Button data-variant="info" data-appearance="ghost">
                    Ghost
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-variant="success">Solid</Button>
                <Button data-variant="success" data-appearance="soft">
                    Soft
                </Button>
                <Button data-variant="success" data-appearance="soft-outlined">
                    Soft Outlined
                </Button>
                <Button data-variant="success" data-appearance="outlined">
                    Outlined
                </Button>
                <Button data-variant="success" data-appearance="ghost">
                    Ghost
                </Button>
            </div>
            <div className="cluster gutter-2xs">
                <Button data-variant="warning">Solid</Button>
                <Button data-variant="warning" data-appearance="soft">
                    Soft
                </Button>
                <Button data-variant="warning" data-appearance="soft-outlined">
                    Soft Outlined
                </Button>
                <Button data-variant="warning" data-appearance="outlined">
                    Outlined
                </Button>
                <Button data-variant="warning" data-appearance="ghost">
                    Ghost
                </Button>
            </div>
        </div>
    );
}
