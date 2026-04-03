import { Suspense } from "react"

import { DiProvider } from "@/di/react/di.provider"
import { AppInitializer, Bootstrap } from "./app.initializer"
import { RouterProvider } from "./routes/provider"

function AfterDi() {
    return <RouterProvider />
}

export function App() {
    return (
        <Suspense fallback={<Bootstrap />}>
            <DiProvider>
                <AppInitializer>
                    <AfterDi />
                </AppInitializer>
            </DiProvider>
        </Suspense>
    )
}

export default App
