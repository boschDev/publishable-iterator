type PublishableIteratorCallback<T> = (value: IteratorResult<T>) => void

const registeredCallbacksSymbol = Symbol('registeredCallbacks')
const activeClientsSymbol = Symbol('activeClients')

const trigger = <T extends (...args: any[]) => any> (cb: T | undefined, ...args: Parameters<T>) => cb != null && cb(...args)

class PublishableIteratorClient<T> implements AsyncIterableIterator<T> {
  [Symbol.asyncIterator] (): AsyncIterableIterator<any> {return this}

  constructor (private readonly publishableIterator: PublishableIterator<T>) {
    publishableIterator[activeClientsSymbol].add(this)
    trigger(this.publishableIterator.onIteratorStarted)
  }

  private cleanup () {
    const activeClients = this.publishableIterator[activeClientsSymbol]
    activeClients.delete(this)
    trigger(this.publishableIterator.onIteratorStopped)
    if (activeClients.size === 0) {
      trigger(this.publishableIterator.onNoActiveIterators)
    }
  }

  async next (): Promise<IteratorResult<T>> {
    return await this.publishableIterator.waitUntilValue()
  }

  async return (value?: PromiseLike<any> | any): Promise<IteratorResult<T>> {
    this.cleanup()
    return { done: true, value: await value }
  }

  async throw (e?: any): Promise<IteratorResult<T>> {
    this.cleanup()
    return { done: true, value: e }
  }
}

export default class PublishableIterator<T = any> implements AsyncIterable<T> {
  [Symbol.asyncIterator] (): AsyncIterableIterator<any> {
    return this.iterator()
  }

  private [registeredCallbacksSymbol]: PublishableIteratorCallback<T>[] = []
  private [activeClientsSymbol] = new Set<PublishableIteratorClient<T>>()

  public onIteratorStarted: undefined | (() => void)
  public onIteratorStopped: undefined | (() => void)
  public onNoActiveIterators: undefined | (() => void)

  async waitUntilValue (): Promise<IteratorResult<T>> {
    return await new Promise<IteratorResult<T>>(resolve => {
      this[registeredCallbacksSymbol].push(resolve)
    })
  }

  publish (value: T, done?: true) {
    const publishValue: IteratorResult<T> = { value, done }
    let listener: PublishableIteratorCallback<T> | undefined
    while (listener = this[registeredCallbacksSymbol].shift()) {
      listener(publishValue)
    }
  }

  iterator (): PublishableIteratorClient<T> {
    return new PublishableIteratorClient<T>(this)
  }
}
