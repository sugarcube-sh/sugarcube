import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";

export function InputAppearancesDemo() {
    return (
        <div className="flow">
            <Label htmlFor="ex-1">Example input</Label>
            <Input id="ex-1" className="input" placeholder="Enter your email" />
            <Label htmlFor="ex-2">Example input</Label>
            <Input
                id="ex-2"
                className="input"
                placeholder="Enter your email"
                data-appearance="soft"
            />
            <Label htmlFor="ex-3">Example input</Label>
            <Input
                id="ex-3"
                className="input"
                placeholder="Enter your email"
                data-appearance="soft-outlined"
            />
        </div>
    );
}
