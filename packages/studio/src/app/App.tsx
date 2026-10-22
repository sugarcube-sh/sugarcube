import { Outlet } from "react-router";
import { AppSidebar } from "../components/app-sidebar";
import { Separator } from "../components/ui/separator/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar/sidebar";
import { TooltipProvider } from "../components/ui/tooltip/tooltip";
import { Problems } from "../canvas/Problems";
import { ChangeBar } from "../inspector/ChangeBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { Search } from "./Search";
import { useSearch } from "./use-search";
import { useUndoKeys } from "./use-undo-keys";

export function App() {
    const { open, close } = useSearch();
    useUndoKeys();

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
                            <Problems />
                        </div>
                    </main>
                    <ChangeBar />
                </SidebarInset>
                {open && <Search onClose={close} />}
            </TooltipProvider>
        </SidebarProvider>
    );
}
