import { Button } from "@/registry/components/button/react/button";
import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/registry/components/popover/react/popover";

export function PopoverDemo() {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button data-variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
                <div className="grid gap-sm w-80">
                    <div className="flow">
                        <h4 className="text-base font-weight-medium">Dimensions</h4>
                        <p className="text-sm text-quiet flow-space-3xs">
                            Set the dimensions for the layer.
                        </p>
                    </div>
                    <div className="grid gap-2xs">
                        <div className="grid grid-cols-3 items-center">
                            <Label htmlFor="width" className="text-sm font-weight-medium">
                                Width
                            </Label>
                            <Input
                                id="width"
                                defaultValue="100%"
                                data-size="sm"
                                className="col-span-2"
                            />
                        </div>
                        <div className="grid grid-cols-3 items-center">
                            <Label htmlFor="maxWidth" className="text-sm font-weight-medium">
                                Max. width
                            </Label>
                            <Input
                                id="maxWidth"
                                defaultValue="300px"
                                data-size="sm"
                                className="col-span-2"
                            />
                        </div>
                        <div className="grid grid-cols-3 items-center">
                            <Label htmlFor="height" className="text-sm font-weight-medium">
                                Height
                            </Label>
                            <Input
                                id="height"
                                defaultValue="25px"
                                data-size="sm"
                                className="col-span-2"
                            />
                        </div>
                        <div className="grid grid-cols-3 items-center">
                            <Label htmlFor="maxHeight" className="text-sm font-weight-medium">
                                Max. height
                            </Label>
                            <Input
                                id="maxHeight"
                                defaultValue="none"
                                data-size="sm"
                                className="col-span-2"
                            />
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
