"use client";

import { Button } from "@/registry/components/button/react/button";
import { InputGroup, InputGroupInput } from "@/registry/components/input/react/input-group";
import { Label } from "@/registry/components/label/react/label";
import { SearchIcon, X } from "lucide-react";
import { useState } from "react";

export function InputGroupDemo() {
    const [value, setValue] = useState("");

    return (
        <InputGroup>
            <Label htmlFor="search-input" className="input-group-icon">
                <SearchIcon />
            </Label>
            <InputGroupInput
                id="search-input"
                type="text"
                placeholder="Search..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
            />
            {value && (
                <Button
                    data-appearance="ghost"
                    onClick={() => setValue("")}
                    aria-label="Clear input"
                    className="is-icon-only button-sm"
                >
                    <X />
                </Button>
            )}
        </InputGroup>
    );
}
