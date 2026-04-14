import { type ChangeEvent, type KeyboardEvent } from "react"
import { SendHorizontal } from "lucide-react"
import { Button, TextArea } from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"

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
            className="flex shrink-0 items-center gap-2 border-t border-divider bg-default-50 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
            onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
            }}
        >
            <TextArea
                value={value}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    onChange(e.target.value)
                }
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        onSubmit()
                    }
                }}
                placeholder={t("chat.messagePlaceholder")}
                autoComplete="off"
                aria-label={t("chat.messagePlaceholder")}
                fullWidth
                variant="secondary"
                rows={1}
                style={{ resize: "none" }}
                className="min-w-0 flex-1 rounded-2xl"
            />

            <Button
                isIconOnly
                variant="primary"
                className="size-11 shrink-0 rounded-full shadow-sm"
                isDisabled={!value.trim()}
                aria-label={t("chat.sendOpenEncrypted")}
                type="submit"
            >
                <SendHorizontal className="size-5" />
            </Button>
        </form>
    )
}

