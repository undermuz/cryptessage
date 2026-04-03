import { createRoute } from "@tanstack/react-router";

import { root } from "../index";

import Page from "./page";

export const indexRoute = createRoute({
    getParentRoute: () => root,
    path: "/nested-page",
    component: Page,
});

export const tree = indexRoute;
