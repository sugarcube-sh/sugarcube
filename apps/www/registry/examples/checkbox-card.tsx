import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Label } from "@/registry/components/label/react/label";

export function CheckboxCardDemo() {
    return (
        <Label className="checkbox-card cluster items-start">
            <Checkbox id="checkbox-card" defaultChecked />
            <div className="flow flow-space-2xs">
                <p className="leading-none">Enable notifications</p>
                <p className="text-quiet">You can enable or disable notifications at any time.</p>
            </div>
        </Label>
    );
}
