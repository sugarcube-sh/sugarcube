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

export function RadioGroupCard() {
    return (
        <RadioGroup defaultValue="starter" className="radio-group-card flow flow-space-xs">
            {plans.map((plan) => (
                <Label className="flex flex-nowrap gap-xs" key={plan.id}>
                    <RadioGroupItem value={plan.id} id={plan.name} className="" />
                    <div className="flow">
                        <div className="font-weight-semibold">{plan.name}</div>
                        <div className="text-sm text-quiet">{plan.description}</div>
                    </div>
                </Label>
            ))}
        </RadioGroup>
    );
}
