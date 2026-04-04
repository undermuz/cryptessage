import { Suspense } from "react"

import { DiProvider } from "@/di/react/di.provider"
import { AppInitializer, Bootstrap } from "./app.initializer"
import { RouterProvider } from "./routes/provider"
import { ThemeProvider } from "./theme"

function AfterDi() {
    return <RouterProvider />
}

export function App() {
    return (
        <ThemeProvider>
            <Suspense fallback={<Bootstrap />}>
                <DiProvider>
                    <AppInitializer>
                        <AfterDi />
                    </AppInitializer>
                </DiProvider>
            </Suspense>
        </ThemeProvider>
    )
}

export default App
