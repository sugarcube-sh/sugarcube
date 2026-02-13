import { Label } from "@/registry/components/label/react/label";
import { RadioGroup, RadioGroupItem } from "@/registry/components/radio-group/react/radio-group";

const plans = [
    {
        id: "starter",
        name: "Starter Plan",
        description: "Perfect for small businesses getting started with our platform",
        price: "$10",
    },
    {
        id: "pro",
        name: "Pro Plan",
        description: "Advanced features for growing businesses with higher demands",
        price: "$20",
    },
] as const;

export function RadioGroupDemo() {
    return (
        <div className="flow">
            <RadioGroup className="flow flow-space-xs" defaultValue="comfortable">
                <div className="cluster gap-xs">
                    <RadioGroupItem value="default" id="r1" />
                    <Label htmlFor="r1">Default</Label>
                </div>
                <div className="cluster gap-xs">
                    <RadioGroupItem value="comfortable" id="r2" />
                    <Label htmlFor="r2">Comfortable</Label>
                </div>
                <div className="cluster gap-xs">
                    <RadioGroupItem value="compact" id="r3" />
                    <Label htmlFor="r3">Compact</Label>
                </div>
            </RadioGroup>
            <RadioGroup defaultValue="starter" className="">
                {plans.map((plan) => (
                    <Label className="" key={plan.id}>
                        <RadioGroupItem value={plan.id} id={plan.name} className="" />
                        <div className="">
                            <div className="">{plan.name}</div>
                            <div className="text-xs text-quiet">{plan.description}</div>
                        </div>
                    </Label>
                ))}
            </RadioGroup>
        </div>
    );
}
