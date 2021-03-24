type PublishableIteratorCallback<T> = (value: IteratorResult<T>) => void

const activeClientsSymbol = Symbol('activeClients')

const trigger = <T extends (...args: any[]) => any> (cb: T | undefined, ...args: Parameters<T>) => cb != null && cb(...args)

class PublishableIteratorClient<T> implements AsyncIterableIterator<T> {
  [Symbol.asyncIterator] (): AsyncIterableIterator<any> {return this}

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

  constructor (private readonly publishableIterator: PublishableIterator<T>) {
    publishableIterator[activeClientsSymbol].add(this)
    trigger(this.publishableIterator.onIteratorStarted)
  }

  private cleanup () {
    if (!this.active) return
    this.active = false

    this.messagesToSend = []
    const activeClients = this.publishableIterator[activeClientsSymbol]
    activeClients.delete(this)
    trigger(this.publishableIterator.onIteratorStopped)
    if (activeClients.size === 0) {
      trigger(this.publishableIterator.onNoActiveIterators)
    }
  }

  private async getNextValue (): Promise<IteratorResult<T>> {
    if (this.messagesToSend.length !== 0) {
      return this.messagesToSend.shift() as any
    }

    return await new Promise<IteratorResult<T>>(resolve => {
      this.pushValueCallback = resolve
    })
  }

  async next (): Promise<IteratorResult<T>> {
    const value = await this.getNextValue()
    if (value.done) return this.return()
    return value
  }

  async return (): Promise<IteratorResult<T>> {
    this.cleanup()
    return { done: true, value: null }
  }

  async throw (error?: any): Promise<IteratorResult<T>> {
    this.cleanup()
    return Promise.reject(error)
  }
}

export default class PublishableIterator<T = any> implements AsyncIterable<T> {
  [Symbol.asyncIterator] (): AsyncIterableIterator<any> {
    return this.iterator()
  }

  private [activeClientsSymbol] = new Set<PublishableIteratorClient<T>>()

  public onIteratorStarted: undefined | (() => void)
  public onIteratorStopped: undefined | (() => void)
  public onNoActiveIterators: undefined | (() => void)

  publish (value: T, done?: true) {
    const publishValue: IteratorResult<T> = { value, done }
    this[activeClientsSymbol].forEach(client => {
      client.pushValue(publishValue)
    })
  }

  iterator (): PublishableIteratorClient<T> {
    return new PublishableIteratorClient<T>(this)
  }
}
