import { Button } from "@/registry/components/button/react/button";

export function ButtonVariants() {
    return (
        <div className="cluster gutter-2xs">
            <Button>Default</Button>
            <Button data-variant="accent">Accent</Button>
            <Button data-variant="neutral">Neutral</Button>
            <Button data-variant="error">Error</Button>
            <Button data-variant="info">Info</Button>
            <Button data-variant="success">Success</Button>
            <Button data-variant="warning">Warning</Button>
        </div>
    );
}
