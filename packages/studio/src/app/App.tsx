import { Outlet } from "react-router";
import { AppSidebar } from "../components/app-sidebar";
import { Separator } from "../components/ui/separator/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar/sidebar";
import { TooltipProvider } from "../components/ui/tooltip/tooltip";
import { ChangeBar } from "../inspector/ChangeBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { Search } from "./Search";
import { useSearch } from "./use-search";

export function App() {
    const { query, setQuery, close } = useSearch();

    const search =
        query === null ? null : <Search query={query} onQuery={setQuery} onClose={close} />;

    return (
        <SidebarProvider className="shell">
            <TooltipProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="canvas-chrome">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="canvas-chrome-divider" />
                        <Breadcrumbs />
                    </header>
                    <main className="canvas">
                        <div className="canvas-body">
                            <Outlet />
                        </div>
                    </main>
                    <ChangeBar />
                </SidebarInset>
                {search}
            </TooltipProvider>
        </SidebarProvider>
    );
}
