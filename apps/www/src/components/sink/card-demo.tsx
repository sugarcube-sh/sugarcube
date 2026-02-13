import { BathIcon, BedIcon, LandPlotIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/registry/components/avatar/react/avatar";
import { Badge } from "@/registry/components/badge/react/badge";
import { Button } from "@/registry/components/button/react/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/registry/components/card/react/card";
import { Input } from "@/registry/components/input/react/input";
import { Label } from "@/registry/components/label/react/label";

export function CardDemo() {
    return (
        <div className="grid-auto" style={{ "--grid-item-min": "24rem" } as React.CSSProperties}>
            <Card>
                <CardHeader>
                    <CardTitle>Login to your account</CardTitle>
                    <CardDescription>
                        Enter your email below to login to your account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" required />
                        </div>
                        <div className="flow flow-space-2xs">
                            <div className="repel">
                                <Label htmlFor="password">Password</Label>
                                <a href="/" className="">
                                    Forgot your password?
                                </a>
                            </div>
                            <Input id="password" type="password" required />
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flow">
                    <Button className="button-neutral w-full" type="submit">
                        Login
                    </Button>
                    <Button className="w-full flow-space-xs">Login with Google</Button>
                    <div className="text-center">
                        Don&apos;t have an account?{" "}
                        <a href="/" className="">
                            Sign up
                        </a>
                    </div>
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Meeting Notes</CardTitle>
                    <CardDescription>Transcript from the meeting with the client.</CardDescription>
                </CardHeader>
                <CardContent className="flow">
                    <p>Client requested dashboard redesign with focus on mobile responsiveness.</p>
                    <ol className="list-inside flow flow-space-3xs">
                        <li>New analytics widgets for daily/weekly metrics</li>
                        <li>Simplified navigation menu</li>
                        <li>Dark mode support</li>
                        <li>Timeline: 6 weeks</li>
                        <li>Follow-up meeting scheduled for next Tuesday</li>
                    </ol>
                </CardContent>
                <CardFooter>
                    <div className="avatar-group" data-overlap>
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
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Is this an image?</CardTitle>
                    <CardDescription>This is a card with an image.</CardDescription>
                </CardHeader>
                <CardContent>
                    <img
                        src="https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80"
                        alt="A house with a pool"
                        className="aspect-video object-cover"
                        width={500}
                        height={500}
                    />
                </CardContent>
                <CardFooter>
                    <Badge data-variant="outline">
                        <BedIcon /> 4
                    </Badge>
                    <Badge data-variant="outline">
                        <BathIcon /> 2
                    </Badge>
                    <Badge data-variant="outline">
                        <LandPlotIcon /> 350m²
                    </Badge>
                    <div className="tabular-nums">$135,000</div>
                </CardFooter>
            </Card>
            <div className="cluster cluster-gap-md">
                <Card>
                    <CardContent>Content Only</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Header Only</CardTitle>
                        <CardDescription>
                            This is a card with a header and a description.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Header and Content</CardTitle>
                        <CardDescription>
                            This is a card with a header and a content.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>Content</CardContent>
                </Card>
                <Card>
                    <CardFooter>Footer Only</CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Header + Footer</CardTitle>
                        <CardDescription>
                            This is a card with a header and a footer.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>Footer</CardFooter>
                </Card>
                <Card>
                    <CardContent>Content</CardContent>
                    <CardFooter>Footer</CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Header + Footer</CardTitle>
                        <CardDescription>
                            This is a card with a header and a footer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>Content</CardContent>
                    <CardFooter>Footer</CardFooter>
                </Card>
            </div>
        </div>
    );
}
