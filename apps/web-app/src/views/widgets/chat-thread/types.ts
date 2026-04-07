export type ImportSource = "camera" | "clipboard" | "file"

export type DecryptPreviewState =
    | { ok: true; text: string; sig: boolean }
    | { ok: false; err: string }
