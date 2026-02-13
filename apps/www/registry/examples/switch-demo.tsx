import { Label } from "@/registry/components/label/react/label";
import { Switch } from "@/registry/components/switch/react/switch";

export function SwitchDemo() {
    return (
        <div className="cluster">
            <Switch id="airplane-mode" />
            <Label htmlFor="airplane-mode">Airplane Mode</Label>
        </div>
    );
}
