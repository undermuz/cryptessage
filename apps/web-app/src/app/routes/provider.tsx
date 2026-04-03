import {
    createRouter,
    RouterProvider as TanStackRouterProvider,
} from "@tanstack/react-router";

import * as rootRouter from ".";

const router = createRouter({
    routeTree: rootRouter.tree,
    defaultPreload: "intent",
    scrollRestoration: true,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

export function RouterProvider() {
    return (
        <>
            <TanStackRouterProvider router={router} />
            {/* <TanStackRouterDevtools router={router} /> */}
        </>
    );
}
