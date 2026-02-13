import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Label } from "@/registry/components/label/react/label";

export function CheckboxHintDemo() {
    return (
        <div className="flow">
            <div className="cluster gap-xs">
                <Checkbox id="terms-hint" />
                <Label htmlFor="terms-hint">Accept terms and conditions</Label>
            </div>
            <p className="text-xs text-quiet">
                By clicking this checkbox, you agree to the terms and conditions.
            </p>
        </div>
    );
}
