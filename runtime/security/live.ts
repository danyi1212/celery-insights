/** Preserve message order while asynchronous decisions run; bound pending work per direction. */
export class LiveAuthorizationQueue {
  private tail = Promise.resolve()
  private pending = 0
  private stopped = false
  constructor(
    private readonly check: () => Promise<boolean>,
    private readonly close: () => void,
  ) {}

  stop(): void {
    this.stopped = true
  }

  enqueue(deliver: () => void): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (++this.pending > 64) {
      this.stopped = true
      this.close()
      return Promise.resolve()
    }
    this.tail = this.tail.then(async () => {
      try {
        if (!this.stopped && (await this.check())) {
          if (!this.stopped) deliver()
        } else if (!this.stopped) {
          this.stopped = true
          this.close()
        }
      } catch {
        this.stopped = true
        this.close()
      } finally {
        this.pending--
      }
    })
    return this.tail
  }
}
