import { AppWindowIcon, CodeIcon } from "lucide-react";

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
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/registry/components/tabs/react/tabs";

export function TabsDemo() {
    return (
        <div className="flow" style={{ "maxWidth": "440px" }}>
            <Tabs className="flow flow-space-xs" defaultValue="account">
                <TabsList>
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="password">Password</TabsTrigger>
                </TabsList>
                <TabsPanel value="account">
                    <Card className="flow flow-space-md">
                        <CardHeader>
                            <CardTitle>Account</CardTitle>
                            <CardDescription>
                                Make changes to your account here. Click save when you&apos;re done.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="">
                            <form>
                                <div className="">
                                    <Label htmlFor="tabs-demo-name">Name</Label>
                                    <Input id="tabs-demo-name" defaultValue="Pedro Duarte" />
                                </div>
                                <div className="">
                                    <Label htmlFor="tabs-demo-username">Username</Label>
                                    <Input id="tabs-demo-username" defaultValue="@peduarte" />
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter>
                            <Button className="button-primary">Save changes</Button>
                        </CardFooter>
                    </Card>
                </TabsPanel>
                <TabsPanel value="password">
                    <Card className="flow flow-space-md">
                        <CardHeader>
                            <CardTitle>Password</CardTitle>
                            <CardDescription>
                                Change your password here. After saving, you&apos;ll be logged out.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="">
                            <form>
                                <div className="">
                                    <Label htmlFor="tabs-demo-current">Current password</Label>
                                    <Input id="tabs-demo-current" type="password" />
                                </div>
                                <div className="">
                                    <Label htmlFor="tabs-demo-new">New password</Label>
                                    <Input id="tabs-demo-new" type="password" />
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter>
                            <Button className="button-primary">Save password</Button>
                        </CardFooter>
                    </Card>
                </TabsPanel>
            </Tabs>
            <Tabs defaultValue="home">
                <TabsList className="w-fit">
                    <TabsTrigger value="home">Home</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
            </Tabs>
            <Tabs defaultValue="home">
                <TabsList className="w-fit">
                    <TabsTrigger value="home">Home</TabsTrigger>
                    <TabsTrigger value="settings" disabled>
                        Disabled
                    </TabsTrigger>
                </TabsList>
            </Tabs>
            <Tabs defaultValue="preview">
                <TabsList className="w-fit">
                    <TabsTrigger value="preview">
                        <AppWindowIcon />
                        Preview
                    </TabsTrigger>
                    <TabsTrigger value="code">
                        <CodeIcon />
                        Code
                    </TabsTrigger>
                </TabsList>
            </Tabs>
            <Tabs defaultValue="preview">
                <TabsList className="w-fit" data-appearance="underline">
                    <TabsTrigger value="preview">
                        <AppWindowIcon />
                        Preview
                    </TabsTrigger>
                    <TabsTrigger value="code">
                        <CodeIcon />
                        Code
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
}
