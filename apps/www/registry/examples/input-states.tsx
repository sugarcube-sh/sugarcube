import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";

export function InputStatesDemo() {
    return (
        <div className="flow">
            <Label htmlFor="ex-1">Example input</Label>
            <Input id="ex-1" type="email" placeholder="Enter your email" aria-invalid="true" />
            <Label htmlFor="ex-2">Example input</Label>
            <Input id="ex-2" type="email" placeholder="Enter your email" disabled />
        </div>
    );
}
