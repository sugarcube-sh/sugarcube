import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../components/ui/tabs/tabs";
import { usePendingChangesCount } from "../store/hooks";
import { Header } from "./Header";
import { DesignView } from "./views/DesignView";
import { DiffView } from "./views/DiffView";

export function Shell() {
    const pendingCount = usePendingChangesCount();

    return (
        <div>
            <Header />

            <Tabs defaultValue="design">
                <TabsList aria-label="Studio sections">
                    <TabsTrigger value="design">Design</TabsTrigger>
                    <TabsTrigger value="diff">
                        Diff
                        {pendingCount > 0 && (
                            <>
                                {" "}
                                <span aria-label={`${pendingCount} pending`}>({pendingCount})</span>
                            </>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="tokens" disabled>
                        Tokens
                    </TabsTrigger>
                </TabsList>

                <TabsPanel value="design">
                    <DesignView />
                </TabsPanel>
                <TabsPanel value="diff">
                    <DiffView />
                </TabsPanel>
                <TabsPanel value="tokens">
                    <p>Coming soon</p>
                </TabsPanel>
            </Tabs>
        </div>
    );
}
