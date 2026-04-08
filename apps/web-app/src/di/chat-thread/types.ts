import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"

export const ChatThreadService = Symbol.for("ChatThreadService")

export type ImportSource = "camera" | "clipboard" | "file"

export type DecryptPreviewState =
    | { ok: true; text: string; sig: boolean }
    | { ok: false; err: string }

export type ChatThreadState = {
    contactId: string | null
    /** False until first `setActiveContactId` load finishes for current id */
    screenReady: boolean
    contact: ContactPlain | null
    fullMessages: MessagePlain[]
    listItems: MessagePlain[]
    composerPlain: string
    armoredOut: string
    messageQrPayload: Uint8Array | null
    pasteIn: string
    warnLen: boolean
    toast: string | null
    exportQrExpanded: boolean
    importScan: boolean
    importPending: {
        raw: VisitCardRawPayload
        source: ImportSource
    } | null
    importDecryptLoading: boolean
    importDecryptPreview: {
        text: string
        signaturesValid: boolean
    } | null
    importDecryptErr: string | null
    pasteQrBusy: boolean
    encryptBusy: boolean
    listDisable: boolean
    inboundPreview: Record<string, DecryptPreviewState>
    outboundPreview: Record<string, DecryptPreviewState>
    pendingScrollToBottom: boolean
}

export type ChatLoadMoreHandler = (
    direction: "up" | "down",
    refItem: MessagePlain,
) => Promise<MessagePlain[]>

export type IChatThreadService = {
    readonly state: ChatThreadState
    setActiveContactId(contactId: string | null): Promise<void>
    setComposerPlain(value: string): void
    setPasteIn(value: string): void
    setExportQrExpanded(value: boolean): void
    setImportScan(open: boolean): void
    setImportPending(
        pending: ChatThreadState["importPending"],
    ): void
    setListItems(items: MessagePlain[]): void
    clearToast(): void
    setToast(message: string | null): void
    clearPendingScrollToBottom(): void
    reload(): Promise<void>
    loadMore: ChatLoadMoreHandler
    jumpListToBottom(): void
    encryptOnSendDialogOpened(): Promise<void>
    decryptArmoredPaste(): Promise<void>
    /** Resolves `true` when the message was saved */
    confirmSaveScannedInbound(): Promise<boolean>
    pasteMessageQrFromClipboard(): Promise<void>
    pickMessageQrFromFile(file: File): Promise<void>
}
