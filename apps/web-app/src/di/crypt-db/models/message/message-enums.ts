export type MessageDirection = "in" | "out"

export type MessageTransportState =
    | "sending"
    | "sent"
    | "needs_action"
    | "failed"
