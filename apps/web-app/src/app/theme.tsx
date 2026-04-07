import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react"

export const THEME_STORAGE_KEY = "cryptessage-theme"

export type ThemePreference = "light" | "dark" | "system"

const THEME_COLOR_LIGHT = "#fafafa"
const THEME_COLOR_DARK = "#09090b"

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
    if (preference === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
    }

    return preference
}

/** Applies `.dark` on `<html>` and returns the resolved scheme. */
export function applyThemeClass(preference: ThemePreference): "light" | "dark" {
    const resolved = resolveTheme(preference)
    document.documentElement.classList.toggle("dark", resolved === "dark")
    return resolved
}

function readStoredPreference(): ThemePreference {
    try {
        const v = localStorage.getItem(THEME_STORAGE_KEY)

        if (v === "light" || v === "dark" || v === "system") {
            return v
        }
    } catch {
        /* private mode, etc. */
    }

    return "system"
}

function syncThemeColorMeta(resolved: "light" | "dark"): void {
    const meta = document.querySelector('meta[name="theme-color"]')

    if (meta) {
        meta.setAttribute(
            "content",
            resolved === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT,
        )
    }
}

type ThemeContextValue = {
    preference: ThemePreference
    setPreference: (p: ThemePreference) => void
    resolved: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [preference, setPreferenceState] = useState<ThemePreference>(
        readStoredPreference,
    )
    const [resolved, setResolved] = useState<"light" | "dark">(() =>
        resolveTheme(readStoredPreference()),
    )

    const setPreference = useCallback((p: ThemePreference) => {
        setPreferenceState(p)

        try {
            localStorage.setItem(THEME_STORAGE_KEY, p)
        } catch {
            /* ignore */
        }
    }, [])

    useEffect(() => {
        const r = applyThemeClass(preference)
        setResolved(r)
        syncThemeColorMeta(r)
    }, [preference])

    useEffect(() => {
        if (preference !== "system") {
            return
        }

        const mq = window.matchMedia("(prefers-color-scheme: dark)")

        const onChange = () => {
            const r = applyThemeClass("system")
            setResolved(r)
            syncThemeColorMeta(r)
        }

        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [preference])

    const value = useMemo(
        () => ({
            preference,
            setPreference,
            resolved,
        }),
        [preference, setPreference, resolved],
    )

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    )
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)

    if (!ctx) {
        throw new Error("useTheme must be used within ThemeProvider")
    }

    return ctx
}
