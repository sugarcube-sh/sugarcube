import { Button } from "@/registry/components/button/react/button";

export function ButtonSizes() {
    return (
        <div className="flow">
            <div className="cluster gutter-2xs">
                <Button data-size="sm">Small</Button>
                <Button>Default</Button>
                <Button data-size="md">Medium</Button>
                <Button data-size="lg">Large</Button>
            </div>
        </div>
    );
}
