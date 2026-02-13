import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Label } from "@/registry/components/label/react/label";

export function CheckboxSizesDemo() {
    return (
        <div className="flow flow-space-xs">
            <div className="cluster gap-xs">
                <Checkbox id="terms-sm" data-size="sm" />
                <Label htmlFor="terms-sm">Accept terms and conditions</Label>
            </div>
            <div className="cluster gap-xs">
                <Checkbox id="terms-md" data-size="md" />
                <Label className="text-base" htmlFor="terms-md">
                    Accept terms and conditions
                </Label>
            </div>
            <div className="cluster gap-xs">
                <Checkbox id="terms-lg" data-size="lg" />
                <Label className="text-lg" htmlFor="terms-lg">
                    Accept terms and conditions
                </Label>
            </div>
        </div>
    );
}
