import { Outlet } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";

export function RootLayout() {
    return (
        <AnimatePresence mode="wait">
            <Outlet />
        </AnimatePresence>
    );
}
