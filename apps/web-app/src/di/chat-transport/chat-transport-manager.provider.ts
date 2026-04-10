import { inject, injectable } from "inversify"

import type { ContactPlain } from "@/di/crypt-db/types-data"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import {
    EventBusProvider,
    type IEventObserver,
} from "@/di/utils/event-bus/types"

import { BUILTIN_QR_TEXT_INSTANCE_ID } from "./constants"
import { qrTextBuiltinProfile } from "./builtin-profiles"
import { buildRecipientTransportMeta } from "./transport-meta"
import {
    ChatTransportOutgoingStore,
    ChatTransportRegistry,
    TransportPrefsService,
    type IChatTransportManager,
    type IChatTransportOutgoingStore,
    type IChatTransportRegistry,
    type ITransportPrefsService,
    type ResolvedTransportProfile,
} from "./types"

type ChatTransportEvents = {
    "chatTransport:openQrReceive": []
}

@injectable()
export class ChatTransportManagerProvider implements IChatTransportManager {
    @inject(ChatTransportRegistry)
    private readonly registry!: IChatTransportRegistry

    @inject(ChatTransportOutgoingStore)
    private readonly outgoing!: IChatTransportOutgoingStore

    @inject(TransportPrefsService)
    private readonly prefs!: ITransportPrefsService

    @inject(EventBusProvider)
    private readonly events!: IEventObserver<ChatTransportEvents>

    public async listAllProfilesResolved(): Promise<ResolvedTransportProfile[]> {
        const p = await this.prefs.load()
        const merged: ResolvedTransportProfile[] = [{ ...qrTextBuiltinProfile }]

        for (const prof of p.profiles) {
            if (prof.enabled) {
                merged.push({ ...prof, builtIn: false })
            }
        }

        return merged
    }

    public async getOrderedProfilesForContact(
        contact: ContactPlain,
    ): Promise<ResolvedTransportProfile[]> {
        const prefs = await this.prefs.load()
        const all = await this.listAllProfilesResolved()
        const byId = new Map(all.map((x) => [x.instanceId, x]))

        const ids: string[] = []

        const add = (id: string) => {
            if (!byId.has(id) || ids.includes(id)) {
                return
            }

            ids.push(id)
        }

        if (contact.transportInstanceOrder?.length) {
            for (const id of contact.transportInstanceOrder) {
                add(id)
            }
        } else {
            const defaultId =
                contact.preferredTransportInstanceId ??
                prefs.defaultInstanceId

            if (defaultId) {
                add(defaultId)
            }

            for (const prof of prefs.profiles) {
                if (prof.enabled) {
                    add(prof.instanceId)
                }
            }
        }

        add(BUILTIN_QR_TEXT_INSTANCE_ID)

        const out: ResolvedTransportProfile[] = []

        for (const id of ids) {
            const row = byId.get(id)

            if (row) {
                out.push(row)
            }
        }

        return out
    }

    public async prepareOutgoingForDisplay(
        contact: ContactPlain,
        bundle: EncryptedOutgoingBundle,
    ): Promise<{ usedInstanceId: string; usedKind: string }> {
        this.outgoing.setLastNetworkDelivery(null)

        const meta = buildRecipientTransportMeta(contact)

        this.outgoing.setPending({
            contactId: contact.id,
            meta,
            bundle,
        })

        const order = await this.getOrderedProfilesForContact(contact)

        for (const prof of order) {
            const impl = this.registry.getByKind(prof.kind)

            if (!impl) {
                continue
            }

            let cfg: unknown

            try {
                cfg = impl.parseConfig(prof.config)
            } catch {
                continue
            }

            try {
                await impl.send(bundle.qrPayloadBinary, meta, cfg)
            } catch {
                continue
            }

            return { usedInstanceId: prof.instanceId, usedKind: prof.kind }
        }

        throw new Error("No transport could handle outgoing message")
    }

    public clearOutgoing(): void {
        this.outgoing.setPending(null)
    }

    public openQrReceiveFallback(): void {
        this.events.emit("chatTransport:openQrReceive")
    }
}
