import { Label } from "@/registry/components/label/react/label";
import { RadioGroup, RadioGroupItem } from "@/registry/components/radio-group/react/radio-group";

export function RadioGroupSizesDemo() {
    return (
        <div className="flow flow-space-xs">
            <RadioGroup defaultValue="sm" className="flow">
                <div className="cluster cluster-gap-2xs">
                    <RadioGroupItem value="sm" id="r-sm" data-size="sm" />
                    <Label htmlFor="r-sm">Small</Label>
                </div>
                <div className="cluster cluster-gap-2xs">
                    <RadioGroupItem value="md" id="r-md" data-size="md" />
                    <Label htmlFor="r-md">Medium</Label>
                </div>
                <div className="cluster cluster-gap-2xs">
                    <RadioGroupItem value="lg" id="r-lg" data-size="lg" />
                    <Label htmlFor="r-lg">Large</Label>
                </div>
            </RadioGroup>
        </div>
    );
}
