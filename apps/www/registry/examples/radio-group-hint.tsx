import { Label } from "@/registry/components/label/react/label";
import { RadioGroup, RadioGroupItem } from "@/registry/components/radio-group/react/radio-group";

export function RadioGroupHintDemo() {
    return (
        <div className="flow flow-space-xs">
            <RadioGroup defaultValue="option1" className="flow flow-space-xs">
                <div className="cluster cluster-gap-2xs">
                    <RadioGroupItem value="option1" id="r1-hint" />
                    <Label htmlFor="r1-hint">Option 1</Label>
                </div>
                <div className="cluster cluster-gap-2xs">
                    <RadioGroupItem value="option2" id="r2-hint" />
                    <Label htmlFor="r2-hint">Option 2</Label>
                </div>
                <div className="cluster cluster-gap-2xs">
                    <RadioGroupItem value="option3" id="r3-hint" />
                    <Label htmlFor="r3-hint">Option 3</Label>
                </div>
            </RadioGroup>
            <p className="text-xs text-quiet">
                Select an option to proceed. You can change your selection at any time.
            </p>
        </div>
    );
}
