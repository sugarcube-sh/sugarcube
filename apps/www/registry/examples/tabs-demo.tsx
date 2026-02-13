import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/registry/components/tabs/react/tabs";

export const TabsDemo = () => {
    return (
        <Tabs defaultValue="account" className="grid gutter-2xs">
            <TabsList className="w-fit">
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>
            <TabsPanel value="account">
                <p>Tab 1 content</p>
            </TabsPanel>
            <TabsPanel value="password">
                <p>Tab 2 content</p>
            </TabsPanel>
        </Tabs>
    );
};
