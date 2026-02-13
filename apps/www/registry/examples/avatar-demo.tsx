import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";

export default function AvatarDemo() {
    return (
        <Avatar>
            <AvatarImage
                src="https://github.com/mark-tomlinson-dev.png"
                alt="avatar of Mark Tomlinson"
            />
            <AvatarFallback>MT</AvatarFallback>
        </Avatar>
    );
}
