import { inject, injectable } from "inversify"

import type { ContactPlain } from "@/di/crypt-db/types-data"
import type { ILoggerFactory } from "@/di/logger/types"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import type { ILogger } from "@/di/types/logger"

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
/**
 * Orchestrates transport profiles, outgoing payload staging, and send/retry flows
 * for encrypted messages across registered transport implementations.
 */
@injectable()
export class ChatTransportManagerProvider implements IChatTransportManager {
    private readonly log: ILogger

    /** Lookup of transport implementations by `kind`. */
    @inject(ChatTransportRegistry)
    private readonly registry!: IChatTransportRegistry

    /** Holds the pending outgoing bundle and last network delivery metadata for UI. */
    @inject(ChatTransportOutgoingStore)
    private readonly outgoing!: IChatTransportOutgoingStore

    /** Persisted user transport profiles and default instance id. */
    @inject(TransportPrefsService)
    private readonly prefs!: ITransportPrefsService

    constructor(@inject("Factory<Logger>") loggerFactory: ILoggerFactory) {
        this.log = loggerFactory("ChatTransportManager")
    }

    /**
     * Returns built-in QR-text profile plus all enabled user profiles from prefs.
     */
    public async getProfiles(): Promise<ResolvedTransportProfile[]> {
        const p = await this.prefs.load()
        const merged: ResolvedTransportProfile[] = [{ ...qrTextBuiltinProfile }]

        for (const prof of p.profiles) {
            if (prof.enabled) {
                merged.push({ ...prof, builtIn: false })
            }
        }

        return merged
    }

    /**
     * Orders transport profiles for a contact: explicit `transportInstanceOrder`,
     * else preferred/default plus enabled profiles, always ending with the built-in QR profile.
     */
    public async orderProfilesForContact(
        contact: ContactPlain,
    ): Promise<ResolvedTransportProfile[]> {
        const prefs = await this.prefs.load()
        const all = await this.getProfiles()
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
                contact.preferredTransportInstanceId ?? prefs.defaultInstanceId

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

    /**
     * Stages the encrypted bundle for the send UI, clears last delivery, then tries
     * each ordered profile until one successfully sends; returns the winning instance.
     *
     * @throws When no registered transport accepts config and completes `send`.
     */
    public async send(
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

        const order = await this.orderProfilesForContact(contact)

        this.log.debug(
            "Send start: contactId={contactId} profileCount={profileCount}",
            { contactId: contact.id, profileCount: order.length },
        )

        for (const prof of order) {
            const impl = this.registry.getByKind(prof.kind)

            if (!impl) {
                this.log.debug(
                    "Send skip: no implementation for kind={kind} instanceId={instanceId}",
                    { kind: prof.kind, instanceId: prof.instanceId },
                )
                continue
            }

            let cfg: unknown

            try {
                cfg = impl.parseConfig(prof.config)
            } catch (e) {
                this.log.warn(
                    "Send skip: invalid transport config: kind={kind} instanceId={instanceId} error={error}",
                    { kind: prof.kind, instanceId: prof.instanceId, error: e },
                )
                continue
            }

            try {
                await impl.send(bundle.qrPayloadBinary, meta, cfg)
            } catch (e) {
                this.log.warn(
                    "Send attempt failed: kind={kind} instanceId={instanceId} error={error}",
                    { kind: prof.kind, instanceId: prof.instanceId, error: e },
                )
                continue
            }

            this.log.info(
                "Send succeeded: contactId={contactId} kind={kind} instanceId={instanceId}",
                {
                    contactId: contact.id,
                    kind: prof.kind,
                    instanceId: prof.instanceId,
                },
            )

            return { usedInstanceId: prof.instanceId, usedKind: prof.kind }
        }

        this.log.error(
            "Send exhausted: no transport succeeded for contactId={contactId}",
            { contactId: contact.id },
        )

        throw new Error("No transport could handle outgoing message")
    }

    /**
     * POSTs the same pending outgoing again for the given profile (e.g. after a failed
     * attempt while the send modal still holds the same pending bundle).
     *
     * @throws If there is no matching pending outgoing, profile, implementation, or config parse error.
     */
    public async retrySendByInstance(
        contact: ContactPlain,
        instanceId: string,
    ): Promise<void> {
        const pending = this.outgoing.state.pending

        if (!pending || pending.contactId !== contact.id) {
            this.log.warn(
                "Retry send rejected: no pending outgoing for contactId={contactId} instanceId={instanceId}",
                { contactId: contact.id, instanceId },
            )
            throw new Error("No pending outgoing to retry for this contact")
        }

        const profiles = await this.getProfiles()
        const prof = profiles.find((p) => p.instanceId === instanceId)

        if (!prof) {
            this.log.warn(
                "Retry send rejected: profile not found contactId={contactId} instanceId={instanceId}",
                { contactId: contact.id, instanceId },
            )
            throw new Error("Transport profile not found")
        }

        const impl = this.registry.getByKind(prof.kind)

        if (!impl) {
            this.log.warn(
                "Retry send rejected: transport not registered kind={kind} instanceId={instanceId}",
                { kind: prof.kind, instanceId },
            )
            throw new Error(`Transport "${prof.kind}" is not registered`)
        }

        let cfg: unknown

        try {
            cfg = impl.parseConfig(prof.config)
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            this.log.warn(
                "Retry send rejected: invalid config kind={kind} instanceId={instanceId} error={error}",
                { kind: prof.kind, instanceId, error: e },
            )

            throw new Error(reason)
        }

        this.log.debug(
            "Retry send: contactId={contactId} kind={kind} instanceId={instanceId}",
            {
                contactId: contact.id,
                kind: prof.kind,
                instanceId: prof.instanceId,
            },
        )

        try {
            await impl.send(pending.bundle.qrPayloadBinary, pending.meta, cfg)
        } catch (e) {
            this.log.warn(
                "Retry send failed: contactId={contactId} kind={kind} instanceId={instanceId} error={error}",
                {
                    contactId: contact.id,
                    kind: prof.kind,
                    instanceId: prof.instanceId,
                    error: e,
                },
            )
            throw e
        }

        this.log.info(
            "Retry send succeeded: contactId={contactId} kind={kind} instanceId={instanceId}",
            {
                contactId: contact.id,
                kind: prof.kind,
                instanceId: prof.instanceId,
            },
        )
    }

    /** Drops the staged outgoing payload and related UI state in the outgoing store. */
    public clearOutgoing(): void {
        this.log.debug("Clear outgoing staged payload")
        this.outgoing.setPending(null)
    }
}
