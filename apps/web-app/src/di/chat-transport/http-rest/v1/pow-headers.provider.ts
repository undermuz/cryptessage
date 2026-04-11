import { inject, injectable } from "inversify"

import { HttpRestPowCoordinatorProvider } from "./pow-coordinator.provider"
import type { HttpRestParsedConfig } from "./types"

/** Challenge / session headers for inbox POST and outbox GET. */
export type IHttpRestPowHeadersService = {
    buildPowHeaders(
        cfg: HttpRestParsedConfig,
        signal: AbortSignal,
    ): Promise<Record<string, string>>
    onSuccessfulResponse(cfg: HttpRestParsedConfig, response: Response): void
    onAuthFailure(cfg: HttpRestParsedConfig): void
}

@injectable()
export class HttpRestPowHeadersProvider implements IHttpRestPowHeadersService {
    constructor(
        @inject(HttpRestPowCoordinatorProvider)
        private readonly coordinator: HttpRestPowCoordinatorProvider,
    ) {}

    public buildPowHeaders(
        cfg: HttpRestParsedConfig,
        signal: AbortSignal,
    ): Promise<Record<string, string>> {
        return this.coordinator.buildAuthHeaders(cfg, signal)
    }

    public onSuccessfulResponse(
        cfg: HttpRestParsedConfig,
        response: Response,
    ): void {
        this.coordinator.onSuccessfulResponse(cfg, response)
    }

    public onAuthFailure(cfg: HttpRestParsedConfig): void {
        this.coordinator.onAuthFailure(cfg)
    }
}
