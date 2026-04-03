import { DiProvider } from "@/di/react/di.provider"
import { RouterProvider } from "./routes/provider"

export function App() {
    return (
        <>
            <DiProvider>
                <RouterProvider />
            </DiProvider>
        </>
    )
}

export default App
