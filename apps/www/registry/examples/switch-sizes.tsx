import { Label } from "@/registry/components/label/react/label";
import { Switch } from "@/registry/components/switch/react/switch";

export function SwitchSizesDemo() {
    return (
        <div className="flow flow-space-xs">
            <div className="cluster gap-xs">
                <Switch id="switch-size-sm" data-size="sm" />
                <Label htmlFor="switch-size-sm">Small</Label>
            </div>
            <div className="cluster gap-xs">
                <Switch id="switch-size-md" data-size="md" />
                <Label htmlFor="switch-size-md">Medium</Label>
            </div>
            <div className="cluster gap-xs">
                <Switch id="switch-size-lg" data-size="lg" />
                <Label htmlFor="switch-size-lg">Large</Label>
            </div>
        </div>
    );
}
