import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";

export function AvatarSizes() {
    return (
        <div className="cluster">
            <Avatar data-size="sm">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar data-size="lg">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar data-size="xl">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
        </div>
    );
}
