import { Label } from "@/registry/components/label/react/label";
import { RadioGroup, RadioGroupItem } from "@/registry/components/radio-group/react/radio-group";

export function RadioGroupDemo() {
    return (
        <RadioGroup defaultValue="comfortable" className="flow flow-space-xs">
            <div className="cluster cluster-gap-2xs">
                <RadioGroupItem value="default" id="r1" />
                <Label htmlFor="r1">Default</Label>
            </div>
            <div className="cluster cluster-gap-2xs">
                <RadioGroupItem value="comfortable" id="r2" />
                <Label htmlFor="r2">Comfortable</Label>
            </div>
            <div className="cluster cluster-gap-2xs">
                <RadioGroupItem value="compact" id="r3" />
                <Label htmlFor="r3">Compact</Label>
            </div>
        </RadioGroup>
    );
}
