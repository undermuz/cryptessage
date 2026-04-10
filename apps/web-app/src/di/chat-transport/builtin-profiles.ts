import { BUILTIN_QR_TEXT_INSTANCE_ID, QR_TEXT_TRANSPORT_KIND } from "./constants"
import type { ResolvedTransportProfile } from "./types"

/** Built-in QR / armored offline channel (not stored in transport prefs IDB). */
export const qrTextBuiltinProfile: ResolvedTransportProfile = {
    instanceId: BUILTIN_QR_TEXT_INSTANCE_ID,
    kind: QR_TEXT_TRANSPORT_KIND,
    label: "QR / paste",
    config: {},
    enabled: true,
    builtIn: true,
}
