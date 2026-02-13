import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Label } from "@/registry/components/label/react/label";

export function LabelDemo() {
    return (
        <div className="cluster gap-xs">
            <Checkbox id="label-demo" />
            <Label htmlFor="label-demo">Accept terms and conditions</Label>
        </div>
    );
}
