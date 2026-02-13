import { Label } from "@/registry/components/label/react/label";
import { Switch } from "@/registry/components/switch/react/switch";

export function SwitchDemo() {
    return (
        <div className="flow">
            <div className="cluster cluster-gap-xs">
                <Switch id="switch-demo-airplane-mode" />
                <Label htmlFor="switch-demo-airplane-mode">Airplane Mode</Label>
            </div>
            <div className="cluster cluster-gap-xs">
                <Switch id="switch-demo-bluetooth" defaultChecked />
                <Label htmlFor="switch-demo-bluetooth">Bluetooth</Label>
            </div>
            <div className="cluster cluster-gap-xs">
                <Switch id="switch-demo-focus-mode" className="switch-accent" defaultChecked />
                <Label htmlFor="switch-demo-focus-mode">Focus Mode</Label>
            </div>
            <Label className="cluster items-center switch-card">
                <div className="flow flow-space-2xs">
                    <div className="text-sm">Share across devices</div>
                    <div className="text-quiet text-sm">
                        Focus is shared across devices, and turns off when you leave the app.
                    </div>
                </div>
                <Switch id="switch-demo-focus-mode" />
            </Label>
            <Label className="cluster items-center switch-card switch-card-accent">
                <div className="flow flow-space-2xs">
                    <div className="text-sm">Share across devices</div>
                    <div className="text-quiet text-sm">
                        Focus is shared across devices, and turns off when you leave the app.
                    </div>
                </div>
                <Switch id="switch-demo-focus-mode" />
            </Label>
        </div>
    );
}
