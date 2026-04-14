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
            className="flex w-full shrink-0 items-end gap-2 rounded-2xl border border-divider bg-content1/95 p-2.5 shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl dark:bg-default-100/90 dark:ring-white/10 sm:rounded-3xl sm:p-3"
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
                className="min-w-0 flex-1 border-0 bg-default-200/40 shadow-none dark:bg-default-200/25"
            />

            <Button
                isIconOnly
                variant="primary"
                className="size-11 shrink-0 rounded-full shadow-md"
                isDisabled={!value.trim()}
                aria-label={t("chat.sendOpenEncrypted")}
                type="submit"
            >
                <SendHorizontal className="size-5" />
            </Button>
        </form>
    )
}

