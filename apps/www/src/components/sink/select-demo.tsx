import { ChartBarIcon, ChartLineIcon, ChartPieIcon, CircleDashed } from "lucide-react";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/registry/components/select/react/select";

export function SelectDemo() {
    return (
        <div className="cluster">
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Select a fruit" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Fruits</SelectLabel>
                        <SelectItem value="apple">Apple</SelectItem>
                        <SelectItem value="banana">Banana</SelectItem>
                        <SelectItem value="blueberry">Blueberry</SelectItem>
                        <SelectItem value="grapes" disabled>
                            Grapes
                        </SelectItem>
                        <SelectItem value="pineapple">Pineapple</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Select>
                <SelectTrigger className="">
                    <SelectValue placeholder="Large List" />
                </SelectTrigger>
                <SelectContent>
                    {Array.from({ length: 100 }, (_, i) => {
                        const itemId = `item-${i}`;
                        return (
                            <SelectItem key={itemId} value={itemId}>
                                Item {i}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
            <Select disabled>
                <SelectTrigger className="">
                    <SelectValue placeholder="Disabled" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="blueberry">Blueberry</SelectItem>
                    <SelectItem value="grapes" disabled>
                        Grapes
                    </SelectItem>
                    <SelectItem value="pineapple">Pineapple</SelectItem>
                </SelectContent>
            </Select>
            <Select>
                <SelectTrigger className="">
                    <SelectValue
                        placeholder={
                            <>
                                <CircleDashed className="" />
                                With Icon
                            </>
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="line">
                        <ChartLineIcon />
                        Line
                    </SelectItem>
                    <SelectItem value="bar">
                        <ChartBarIcon />
                        Bar
                    </SelectItem>
                    <SelectItem value="pie">
                        <ChartPieIcon />
                        Pie
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
