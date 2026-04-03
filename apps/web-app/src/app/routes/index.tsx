import { createRootRoute, createRoute } from "@tanstack/react-router";

import { RootLayout } from "./layout";
import * as nestedPage from "./nested-page/routes";
import { IndexPage } from "./page";

export const root = createRootRoute({
    component: RootLayout,
});

export const indexRoute = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: IndexPage,
});

export const tree = root.addChildren([indexRoute, nestedPage.tree]);
