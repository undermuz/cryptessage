export default function invariant(
    condition: unknown,
    message: string | (() => string),
): asserts condition {
    if (condition) {
        return
    }

    const value: string = typeof message === "function" ? message() : message

    throw new Error(value)
}
