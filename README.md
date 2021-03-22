# publishable-iterator

A javascript publishable async iterator lib

## Install

```shell
npm install --save publishable-iterator
```

## How to use

```javascript
import PublishableIterator from 'publishable-iterator'

const iterator = new PublishableIterator()

// Iterate over the PublishableIterator
for await (const item of iterator) {
  console.log(item)
}

// This will give all the active iterators a new value
iterator.publish('Hi there')

// This will give all the active iterators a new value
iterator.publish('Stop all the current itterators', true)
```

You can also pass an iterated type in Typescript.

```typescript
interface Foo {
  bar: string
}

const iterator = new PublishableIterator<Foo>()
```
