import { injectable } from "inversify"
import { proxy } from "valtio"

import type { ChatOutgoingPayload, IChatTransportOutgoingStore } from "./types"
import type { LastNetworkDelivery } from "./types"

@injectable()
export class ChatTransportOutgoingStoreProvider implements IChatTransportOutgoingStore {
    public readonly state = proxy({
        pending: null as ChatOutgoingPayload | null,
        lastNetworkDelivery: null as LastNetworkDelivery | null,
    })

    public setPending(payload: ChatOutgoingPayload | null): void {
        this.state.pending = payload

        if (payload === null) {
            this.state.lastNetworkDelivery = null
        }
    }

    public setLastNetworkDelivery(detail: LastNetworkDelivery | null): void {
        this.state.lastNetworkDelivery = detail
    }
}
