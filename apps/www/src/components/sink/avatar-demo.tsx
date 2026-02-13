import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";

export function AvatarDemo() {
    return (
        <div className="cluster gap-md">
            <Avatar>
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar>
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar className="avatar-lg">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <Avatar className="avatar-square">
                <AvatarImage
                    src="https://github.com/mark-tomlinson-dev.png"
                    alt="avatar of Mark Tomlinson"
                />
                <AvatarFallback>MT</AvatarFallback>
            </Avatar>
            <div className="flex align-center" data-avatar-overlap>
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
            <div className="flex align-center" data-avatar-overlap>
                <Avatar className="avatar-lg">
                    <AvatarImage
                        src="https://github.com/mark-tomlinson-dev.png"
                        alt="avatar of Mark Tomlinson"
                    />
                    <AvatarFallback>MT</AvatarFallback>
                </Avatar>
                <Avatar className="avatar-lg">
                    <AvatarImage
                        src="https://github.com/mark-tomlinson-dev.png"
                        alt="avatar of Mark Tomlinson"
                    />
                    <AvatarFallback>MT</AvatarFallback>
                </Avatar>
                <Avatar className="avatar-lg">
                    <AvatarImage
                        src="https://github.com/mark-tomlinson-dev.png"
                        alt="avatar of Mark Tomlinson"
                    />
                    <AvatarFallback>MT</AvatarFallback>
                </Avatar>
            </div>
            <div className="flex align-center" data-avatar-animated data-avatar-overlap>
                <Avatar className="avatar-lg">
                    <AvatarImage
                        src="https://github.com/mark-tomlinson-dev.png"
                        alt="avatar of Mark Tomlinson"
                    />
                    <AvatarFallback>MT</AvatarFallback>
                </Avatar>
                <Avatar className="avatar-lg">
                    <AvatarImage
                        src="https://github.com/mark-tomlinson-dev.png"
                        alt="avatar of Mark Tomlinson"
                    />
                    <AvatarFallback>MT</AvatarFallback>
                </Avatar>
                <Avatar className="avatar-lg">
                    <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
                    <AvatarFallback>MT</AvatarFallback>
                </Avatar>
            </div>
        </div>
    );
}
