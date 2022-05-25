---
title: index.ts
nav_order: 1
parent: Modules
---

## index overview

Added in v0.1.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [endSession](#endsession)
  - [getSession](#getsession)
  - [storeSession](#storesession)
- [model](#model)
  - [SessionEnv (interface)](#sessionenv-interface)

---

# constructors

## endSession

Returns a middleware that ends the current session.

**Signature**

```ts
export declare function endSession(): ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, never, void>
```

Added in v0.1.2

## getSession

Returns a middleware that returns the current session.

**Signature**

```ts
export declare function getSession<I = StatusOpen>(): ReaderMiddleware<SessionEnv, I, I, 'no-session', JsonRecord>
```

Added in v0.1.0

## storeSession

Returns a middleware that stores a value in a session.

**Signature**

```ts
export declare function storeSession(
  session: JsonRecord
): ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, never, void>
```

Added in v0.1.0

# model

## SessionEnv (interface)

**Signature**

```ts
export interface SessionEnv {
  secret: string
  sessionStore: Store<JsonRecord>
}
```

Added in v0.1.0
