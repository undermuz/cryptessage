"use client"

import { Button, Modal } from "@heroui/react"

export function TestModal() {
    return (
        <Modal>
            <Button variant="secondary">Open Modal</Button>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-[360px]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Test modal</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <p>Example modal content for local debugging.</p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button className="w-full" slot="close">
                                Continue
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
