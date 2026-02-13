import { Label } from "@/registry/components/label/react/label";
import { RadioGroup, RadioGroupItem } from "@/registry/components/radio-group/react/radio-group";

export function RadioGroupDisabledDemo() {
    return (
        <RadioGroup defaultValue="option1" className="flow flow-space-xs">
            <div className="cluster cluster-gap-2xs">
                <RadioGroupItem value="option1" id="r1-disabled" />
                <Label htmlFor="r1-disabled">Option 1</Label>
            </div>
            <div className="cluster cluster-gap-2xs">
                <RadioGroupItem value="option2" id="r2-disabled" disabled />
                <Label htmlFor="r2-disabled">Option 2 (disabled)</Label>
            </div>
            <div className="cluster cluster-gap-2xs">
                <RadioGroupItem value="option3" id="r3-disabled" />
                <Label htmlFor="r3-disabled">Option 3</Label>
            </div>
        </RadioGroup>
    );
}
