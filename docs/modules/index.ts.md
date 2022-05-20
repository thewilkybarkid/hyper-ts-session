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
  - [getSession](#getsession)
- [model](#model)
  - [SessionEnv (interface)](#sessionenv-interface)

---

# constructors

## getSession

Returns a middleware that returns the current session.

**Signature**

```ts
export declare function getSession<I = StatusOpen>(): ReaderMiddleware<SessionEnv, I, I, 'no-session', JsonRecord>
```

Added in v0.1.0

# model

## SessionEnv (interface)

**Signature**

```ts
export interface SessionEnv {
  sessionStore: Store<JsonRecord>
}
```

Added in v0.1.0