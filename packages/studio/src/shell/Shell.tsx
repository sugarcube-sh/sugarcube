import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../components/ui/tabs/tabs";
import { Header } from "./Header";
import { DesignArea } from "./areas/DesignArea";

export function Shell() {
    return (
        <div className="shell">
            <Header />

            <Tabs defaultValue="design">
                <TabsList aria-label="Studio sections">
                    <TabsTrigger value="design">Design</TabsTrigger>
                    <TabsTrigger value="tokens">Tokens</TabsTrigger>
                    <TabsTrigger value="components">Components</TabsTrigger>
                </TabsList>

                <TabsPanel value="design">
                    <DesignArea />
                </TabsPanel>
                <TabsPanel value="tokens">
                    <p>Coming soon</p>
                </TabsPanel>
                <TabsPanel value="components">
                    <p>Coming soon</p>
                </TabsPanel>
            </Tabs>
        </div>
    );
}
