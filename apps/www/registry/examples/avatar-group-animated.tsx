import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";

export function AvatarGroupAnimated() {
    return (
        <div className="flex avatar-group is-animated">
            <Avatar>
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
            <Avatar>
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
        </div>
    );
}
