import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Label } from "@/registry/components/label/react/label";

export function CheckboxDisabledDemo() {
    return (
        <div className="cluster gap-xs">
            <Checkbox id="terms-disabled" disabled />
            <Label htmlFor="terms-disabled">Accept terms and conditions</Label>
        </div>
    );
}
