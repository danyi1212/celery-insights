export class CancellationToken {
    isCancellationRequested: boolean
    cancellationCallbacks: (() => void)[]

    constructor() {
        this.isCancellationRequested = false
        this.cancellationCallbacks = []
    }

    cancel() {
        this.isCancellationRequested = true
        this.cancellationCallbacks.forEach((callback) => callback())
    }

    register(callback: () => void) {
        this.cancellationCallbacks.push(callback)
    }
}
