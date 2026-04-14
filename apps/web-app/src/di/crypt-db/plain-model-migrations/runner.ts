import type {
    PlainModelMigrationContext,
    PlainModelMigrationStep,
} from "./types"

export type RunPlainModelMigrationsArgs = {
    currentVersion: number
    setVersion: (version: number) => Promise<void>
    context: PlainModelMigrationContext
    steps: ReadonlyArray<PlainModelMigrationStep>
}

/**
 * Applies `steps[currentVersion..]` in order, persisting the version after each step.
 * Steps must be idempotent for the source version they replace.
 */
export async function runPlainModelMigrations(
    args: RunPlainModelMigrationsArgs,
): Promise<void> {
    const { steps } = args
    let v = args.currentVersion

    if (!Number.isInteger(v) || v < 0) {
        throw new Error(`Invalid plain model version: ${args.currentVersion}`)
    }

    if (v > steps.length) {
        throw new Error(
            `Vault plain model version ${v} is newer than this app supports (${steps.length}). Update the app.`,
        )
    }

    while (v < steps.length) {
        await steps[v]!(args.context)
        v++
        await args.setVersion(v)
    }
}
