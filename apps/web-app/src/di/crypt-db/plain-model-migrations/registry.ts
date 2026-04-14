import type { PlainModelMigrationStep } from "./types"
import { migratePlainModelV0ToV1 } from "./steps/v0-to-v1"
import { migratePlainModelV1ToV2 } from "./steps/v1-to-v2"

/**
 * Ordered chain: step at index `k` upgrades the vault from plain-model version `k` to `k + 1`.
 */
export const PLAIN_MODEL_MIGRATION_STEPS: ReadonlyArray<PlainModelMigrationStep> =
    [migratePlainModelV0ToV1, migratePlainModelV1ToV2]

export const LATEST_PLAIN_MODEL_VERSION = PLAIN_MODEL_MIGRATION_STEPS.length
