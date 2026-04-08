export function isCiphertextForRecipientNotSelf(errMsg: string): boolean {
    return /no decryption key packets found/i.test(errMsg)
}
