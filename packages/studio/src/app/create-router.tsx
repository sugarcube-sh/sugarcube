import { type RouteObject, createMemoryRouter } from "react-router";
import { IndexRoute, NodeRoute } from "../mvp/NodeRoute";
import { App } from "./App";

const routes: RouteObject[] = [
    {
        path: "/",
        Component: App,
        children: [
            { index: true, Component: IndexRoute },
            { path: ":group", Component: NodeRoute },
            { path: ":group/*", Component: NodeRoute },
            { path: "*", Component: IndexRoute },
        ],
    },
];

export function createStudioRouter() {
    return createMemoryRouter(routes);
}
