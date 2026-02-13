import { Button } from "@/registry/components/button/react/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/registry/components/dialog/react/dialog.baseui.tsx";

export function DialogDemo() {
    return (
        <Dialog>
            <DialogTrigger>Open Dialog</DialogTrigger>
            <DialogContent className="flow">
                <DialogTitle>Edit profile</DialogTitle>
                <DialogDescription className="flow-space-2xs">
                    Make changes to your profile here. Click save when you're done.
                </DialogDescription>
                <div className="cluster align-end gap-2xs">
                    <DialogClose data-variant="secondary">Close</DialogClose>
                    <Button>Confirm</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
