import { Label } from "@/registry/components/label/react/label";
import { Switch } from "@/registry/components/switch/react/switch";

export function SwitchDisabledDemo() {
    return (
        <div className="cluster">
            <Switch id="airplane-mode-disabled" disabled />
            <Label htmlFor="airplane-mode-disabled">Airplane Mode</Label>
        </div>
    );
}
