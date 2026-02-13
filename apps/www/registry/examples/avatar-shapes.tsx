import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";

export function AvatarShapes() {
    return (
        <div className="cluster">
            <Avatar>
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <Avatar data-shape="rounded">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <Avatar data-shape="square">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>CN</AvatarFallback>
            </Avatar>
        </div>
    );
}
