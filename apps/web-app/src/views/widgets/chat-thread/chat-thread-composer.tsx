import { SendHorizontal } from "lucide-react"

import { useT } from "@/di/react/hooks/useT"
import { Button } from "@/views/ui/button"

export function ChatThreadComposer({
    value,
    onChange,
    onSubmit,
}: {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
}) {
    const t = useT()

    return (
        <form
            className="flex shrink-0 gap-2 border-t border-border bg-card p-3"
            onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
            }}
        >
            <input
                className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none ring-primary transition-[box-shadow] placeholder:text-muted-foreground focus-visible:ring-2"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t("chat.messagePlaceholder")}
                autoComplete="off"
            />
            <Button
                type="submit"
                size="icon-lg"
                className="shrink-0 rounded-full shadow-md"
                disabled={!value.trim()}
                aria-label={t("chat.sendOpenEncrypted")}
                title={t("chat.sendOpenEncrypted")}
            >
                <SendHorizontal className="size-5" />
            </Button>
        </form>
    )
}
