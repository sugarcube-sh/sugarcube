import { Outlet } from "react-router";
import { Sidebar } from "./components/Sidebar";

export function App() {
    return (
        <div className="studio-layout">
            <Sidebar />
            <main className="studio-main">
                <Outlet />
            </main>
        </div>
    );
}
