import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";

export function InputSizesDemo() {
    return (
        <div className="flow">
            <div>
                <Label htmlFor="unique-example">Example input</Label>
                <Input id="unique-example" placeholder="Enter your email" data-size="xs" />
            </div>
            <div>
                <Label htmlFor="unique-example">Example input</Label>
                <Input id="unique-example" placeholder="Enter your email" data-size="sm" />
            </div>
            <div>
                <Label htmlFor="unique-example">Example input</Label>
                <Input id="unique-example" placeholder="Enter your email" data-size="md" />
            </div>
            <div>
                <Label htmlFor="unique-example">Example input</Label>
                <Input id="unique-example" placeholder="Enter your email" data-size="lg" />
            </div>
        </div>
    );
}
