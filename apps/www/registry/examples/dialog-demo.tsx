import { Button } from "@/registry/components/button/react/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/registry/components/dialog/react/dialog";
import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";

export function DialogDemo() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button data-appearance="outlined">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent className="flow">
                <DialogTitle className="text-lg font-semibold">Edit profile</DialogTitle>
                <DialogDescription className="flow-space-2xs text-sm text-quiet">
                    Make changes to your profile here. Click save when you're done.
                </DialogDescription>
                <div className="flow">
                    <div>
                        <Label htmlFor="name-1">Name</Label>
                        <Input
                            id="name-1"
                            name="name"
                            defaultValue="Teddy Adorno"
                            placeholder="Name"
                            data-size="sm"
                        />
                    </div>
                    <div className="flow-space-2xs">
                        <Label htmlFor="username-1">Username</Label>
                        <Input
                            id="username-1"
                            name="username"
                            defaultValue="@teddyadorno"
                            data-size="sm"
                        />
                    </div>
                </div>
                <div className="cluster justify-end gap-2xs">
                    <DialogClose data-appearance="outlined">Close</DialogClose>
                    <Button>Confirm</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
