export type PlainModelMigrationContext = {
    forEachContact: (
        map: (raw: unknown) => unknown | Promise<unknown>,
    ) => Promise<void>
    forEachMessage: (
        map: (raw: unknown) => unknown | Promise<unknown>,
    ) => Promise<void>
    /** Used when upgrading identity JSON (e.g. v1 → v2). */
    forEachIdentity?: (
        map: (raw: unknown) => unknown | Promise<unknown>,
    ) => Promise<void>
}

export type PlainModelMigrationStep = (
    ctx: PlainModelMigrationContext,
) => Promise<void>
