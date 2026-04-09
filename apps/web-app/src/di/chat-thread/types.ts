import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"

export const ChatThreadService = Symbol.for("ChatThreadService")

export type ImportSource = "camera" | "clipboard" | "file" | "manual"

export type DecryptPreviewState =
    | { ok: true; text: string; sig: boolean }
    | { ok: false; err: string }

export type DecryptedMessageItem = {
    message: MessagePlain
    decrypted: DecryptPreviewState | null
}

export type ChatThreadImportState = {
    data: {
        raw: VisitCardRawPayload
        source: ImportSource
    } | null
    pending: boolean
    decrypted: {
        text: string
        signaturesValid: boolean
    } | null
    error: string | null
}

export type ChatThreadState = {
    contactId: string | null
    contact: ContactPlain | null
    isPendingList: boolean
    encryptedMessages: MessagePlain[]
    decryptedMessages: DecryptedMessageItem[]
    pendingScrollToBottom: boolean
    import: ChatThreadImportState
}

export type ChatLoadMoreHandler = (
    direction: "up" | "down",
    refItem: DecryptedMessageItem,
) => Promise<DecryptedMessageItem[]>

export type IChatThreadService = {
    readonly state: ChatThreadState
    setActiveContactId(contactId: string | null): Promise<void>
    setImportData(data: ChatThreadImportState["data"]): void
    setDecryptedMessages(items: DecryptedMessageItem[]): void
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
