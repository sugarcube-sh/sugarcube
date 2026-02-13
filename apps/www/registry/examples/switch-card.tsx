import { Label } from "@/registry/components/label/react/label";
import { Switch } from "@/registry/components/switch/react/switch";

export function SwitchCardDemo() {
    return (
        <Label className="switch-card">
            <div className="flow flow-space-2xs">
                <div className="text-sm">Share across devices</div>
                <div className="text-quiet text-sm">
                    Focus is shared across devices, and turns off when you leave the app.
                </div>
            </div>
            <Switch id="switch-demo-focus-mode" />
        </Label>
    );
}
