import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"

export const ChatThreadService = Symbol.for("ChatThreadService")

export type ImportSource = "camera" | "clipboard" | "file" | "manual"

export type DecryptPreviewState =
    | { ok: true; text: string; sig: boolean }
    | { ok: false; err: string }

export type ChatThreadImportState = {
    data: {
        raw: VisitCardRawPayload
        source: ImportSource
    } | null
    decryptLoading: boolean
    decryptPreview: {
        text: string
        signaturesValid: boolean
    } | null
    decryptErr: string | null
}

export type ChatThreadState = {
    contactId: string | null
    contact: ContactPlain | null
    isPendingList: boolean
    fullMessages: MessagePlain[]
    listItems: MessagePlain[]
    toast: string | null
    inboundPreview: Record<string, DecryptPreviewState>
    outboundPreview: Record<string, DecryptPreviewState>
    pendingScrollToBottom: boolean
    import: ChatThreadImportState
}

export type ChatLoadMoreHandler = (
    direction: "up" | "down",
    refItem: MessagePlain,
) => Promise<MessagePlain[]>

export type IChatThreadService = {
    readonly state: ChatThreadState
    setActiveContactId(contactId: string | null): Promise<void>
    setImportData(data: ChatThreadImportState["data"]): void
    setListItems(items: MessagePlain[]): void
    clearToast(): void
    setToast(message: string | null): void
    clearPendingScrollToBottom(): void
    reload(): Promise<void>
    loadMore: ChatLoadMoreHandler
    jumpListToBottom(): void
    onSendNewMessage(plain: string): Promise<EncryptedOutgoingBundle>
    importByRaw(armoredText: string): Promise<void>
    /** Resolves `true` when the message was saved */
    applyImport(): Promise<boolean>
    importByQrClipboard(): Promise<void>
    importByQrFile(file: File): Promise<void>
}
