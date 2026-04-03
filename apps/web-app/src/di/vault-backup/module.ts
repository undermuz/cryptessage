import { ContainerModule } from "inversify"

import { VaultBackupProvider } from "./vault-backup.provider"
import { VaultBackupService, type IVaultBackupService } from "./types"

export const VaultBackupModule = new ContainerModule((ctx) => {
    ctx.bind<IVaultBackupService>(VaultBackupService)
        .to(VaultBackupProvider)
        .inSingletonScope()
})
