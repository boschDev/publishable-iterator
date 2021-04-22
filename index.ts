type PublishableIteratorCallback<T> = (value: IteratorResult<T>) => void

const trigger = <T extends (...args: any[]) => any> (triggerFunction: T | undefined, ...args: Parameters<T>): void => {
  if (triggerFunction != null) triggerFunction(...args)
}

class PublishableIteratorClient<T> implements AsyncIterableIterator<T> {
  [Symbol.asyncIterator] (): AsyncIterableIterator<any> { return this }

  active: boolean = true
  messagesToSend: Array<IteratorResult<T>> = []
  private pushValueCallback: PublishableIteratorCallback<T> | undefined

  pushValue (result: IteratorResult<T>): void {
    if (!this.active) return
    if (this.pushValueCallback == null) {
      this.messagesToSend.push(result)
    } else {
      this.pushValueCallback(result)
      this.pushValueCallback = undefined
    }
  }

  constructor (private readonly clientsManager: PublishableIteratorClientsManager<T>) {
    clientsManager.addIterator(this)
  }

  private cleanup (): void {
    if (!this.active) return
    this.active = false

    this.messagesToSend = []
    this.clientsManager.removeIterator(this)
  }

  private async getNextValue (): Promise<IteratorResult<T>> {
    const nextValue = this.messagesToSend.shift()
    if (nextValue != null) return nextValue

    return await new Promise<IteratorResult<T>>(resolve => {
      this.pushValueCallback = resolve
    })
  }

  async next (): Promise<IteratorResult<T>> {
    const value = await this.getNextValue()
    if (value.done === true) {
      return await this.return()
    }
    return value
  }

  async return (): Promise<IteratorResult<T>> {
    this.cleanup()
    return { done: true, value: null }
  }

  async throw (error?: any): Promise<IteratorResult<T>> {
    this.cleanup()
    return await Promise.reject(error)
  }
}

class PublishableIteratorClientsManager<T> {
  private readonly activeClients = new Set<PublishableIteratorClient<T>>()

  constructor (private readonly publishableIterator: PublishableIterator<T>) {}

  get hasActiveIterators (): boolean {
    return this.activeClients.size !== 0
  }

  publish (value: T, done?: true): void {
    const publishValue: IteratorResult<T> = { value, done }
    this.activeClients.forEach(client => {
      client.pushValue(publishValue)
    })
  }

  addIterator (iterator: PublishableIteratorClient<T>): void {
    this.activeClients.add(iterator)
    trigger(this.publishableIterator.onIteratorStarted)
  }

  removeIterator (iterator: PublishableIteratorClient<T>): void {
    this.activeClients.delete(iterator)
    trigger(this.publishableIterator.onIteratorStopped)
    if (!this.publishableIterator.hasActiveIterators) {
      trigger(this.publishableIterator.onNoActiveIterators)
    }
  }
}

export default class PublishableIterator<T = any> implements AsyncIterable<T> {
  [Symbol.asyncIterator] (): AsyncIterableIterator<any> {
    return this.iterator()
  }

  public onIteratorStarted: undefined | (() => void)
  public onIteratorStopped: undefined | (() => void)
  public onNoActiveIterators: undefined | (() => void)

  private readonly clientsManager = new PublishableIteratorClientsManager<T>(this)

  get hasActiveIterators (): boolean {
    return this.clientsManager.hasActiveIterators
  }

  publish (value: T, done?: true): void {
    return this.clientsManager.publish(value, done)
  }

  iterator (): PublishableIteratorClient<T> {
    return new PublishableIteratorClient<T>(this.clientsManager)
  }
}
