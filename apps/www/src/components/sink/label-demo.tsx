import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";
import { Textarea } from "@/registry/components/textarea/react/textarea";

export function LabelDemo() {
    return (
        <div className="flow">
            {/* Checkbox with htmlFor (separate label and input) */}
            <div className="cluster gap-xs">
                <Checkbox id="label-demo-terms" />
                <Label htmlFor="label-demo-terms">Accept terms and conditions</Label>
            </div>

            {/* Checkbox nested within label */}
            <Label>
                <Checkbox id="label-demo-newsletter" />
                Subscribe to newsletter
            </Label>

            {/* Text inputs with htmlFor */}
            <div>
                <Label htmlFor="label-demo-username">Username</Label>
                <Input id="label-demo-username" placeholder="Username" />
            </div>

            <div data-disabled={true}>
                <Label htmlFor="label-demo-disabled">Disabled</Label>
                <Input id="label-demo-disabled" placeholder="Disabled" disabled />
            </div>

            <div>
                <Label htmlFor="label-demo-message">Message</Label>
                <Textarea id="label-demo-message" placeholder="Message" />
            </div>
        </div>
    );
}
