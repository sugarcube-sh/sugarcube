"use client";

import { Checkbox } from "@/registry/components/checkbox/react/checkbox";
import { Label } from "@/registry/components/label/react/label";

export function CheckboxDemo() {
    return (
        <div className="flow">
            <div className="cluster">
                <Checkbox className="checkbox-primary" defaultChecked />
                <Checkbox className="checkbox-secondary" defaultChecked />
                <Checkbox className="checkbox-neutral" defaultChecked />
                <Checkbox className="checkbox-accent" defaultChecked />
                <Checkbox className="checkbox-error" defaultChecked />
                <Checkbox className="checkbox-info" defaultChecked />
                <Checkbox className="checkbox-success" defaultChecked />
                <Checkbox className="checkbox-warning" defaultChecked />
            </div>
            <div className="cluster gap-xs">
                <Checkbox id="terms" />
                <Label htmlFor="terms">Accept terms and conditions</Label>
            </div>
            <Label htmlFor="terms-2">
                <Checkbox id="terms-2" defaultChecked />
                <div className="flow flow-space-2xs">
                    <p className="">Accept terms and conditions</p>
                    <p className="text-quiet">
                        By clicking this checkbox, you agree to the terms and conditions.
                    </p>
                </div>
            </Label>
            <div className="cluster gap-xs">
                <Checkbox id="toggle" disabled />
                <Label htmlFor="toggle">Enable notifications</Label>
            </div>
            <Label className="checkbox-card">
                <Checkbox id="toggle-2" defaultChecked />
                <div className="flow flow-space-2xs">
                    <p className="">Enable notifications</p>
                    <p className="text-quiet">
                        You can enable or disable notifications at any time.
                    </p>
                </div>
            </Label>
        </div>
    );
}
