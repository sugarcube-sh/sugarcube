"use client";

import { Input } from "@/registry/components/input/react/input";
import { SearchIcon, X } from "lucide-react";
import { useState } from "react";

export function InputWithIconDemo() {
    const [value, setValue] = useState("");

    return (
        <div className="input-wrapper">
            <SearchIcon className="input-icon" />
            <Input
                type="text"
                placeholder="Search..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="input-no-border"
            />
            {value && (
                <button
                    type="button"
                    className="input-clear"
                    onClick={() => setValue("")}
                    aria-label="Clear input"
                >
                    <X />
                </button>
            )}
        </div>
    );
}
