import { injectable, multiInject } from "inversify"

import {
    ChatTransport,
    type IChatTransport,
    type IChatTransportRegistry,
} from "./types"

@injectable()
export class ChatTransportRegistryProvider implements IChatTransportRegistry {
    private readonly byKind: Map<string, IChatTransport>

    public constructor(
        @multiInject(ChatTransport) transports: IChatTransport[],
    ) {
        this.byKind = new Map()

        for (const t of transports) {
            this.byKind.set(t.kind, t)
        }
    }

    public getByKind(kind: string): IChatTransport | undefined {
        return this.byKind.get(kind)
    }

    public listKinds(): string[] {
        return [...this.byKind.keys()]
    }

    public getAll(): IChatTransport[] {
        return [...this.byKind.values()]
    }
}
