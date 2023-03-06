import { test } from '@fast-check/jest'
import { describe, expect, jest } from '@jest/globals'
import cookieSignature from 'cookie-signature'
import * as E from 'fp-ts/Either'
import { JsonRecord } from 'fp-ts/Json'
import { HeadersOpen } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import Keyv, { Store } from 'keyv'
import * as _ from '../src'
import * as fc from './fc'
import { runMiddleware } from './middleware'

describe('constructors', () => {
  describe('getSession', () => {
    test.prop([
      fc
        .tuple(fc.string(), fc.uuid())
        .chain(([secret, sessionId]) =>
          fc.tuple(
            fc.constant(secret),
            fc.connection({ headers: fc.constant({ Cookie: `session=${cookieSignature.sign(sessionId, secret)}` }) }),
            fc.constant(sessionId),
            fc.dictionary(fc.lorem(), fc.lorem()),
          ),
        ),
    ])('when there is a session', async ([secret, connection, sessionId, value]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(sessionId, value)

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.right(value))
    })

    test.prop([
      fc.string(),
      fc.connection({ headers: fc.record({ Cookie: fc.uuid().map(sessionId => `session=${sessionId}`) }) }),
    ])("when there isn't a session", async (secret, connection) => {
      const sessionStore = new Keyv()

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left('no-session'))
    })

    test.prop([
      fc.string(),
      fc
        .lorem({ maxCount: 1 })
        .chain(key =>
          fc.tuple(
            fc.connection({ headers: fc.constant({ Cookie: `session=${key}` }) }),
            fc.constant(key),
            fc.dictionary(fc.lorem(), fc.lorem()),
          ),
        ),
    ])('when the session cookie is not a session key', async (secret, [connection, key, value]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(key, value)

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left('no-session'))
    })

    test.prop([
      fc.string(),
      fc.connection({ headers: fc.record({ Cookie: fc.array(fc.cookie()) }, { withDeletedKeys: true }) }),
    ])('when there is no session cookie', async (secret, connection) => {
      const sessionStore = new Keyv()

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left('no-session'))
    })

    test.prop([
      fc
        .tuple(fc.string(), fc.uuid())
        .chain(([secret, sessionId]) =>
          fc.tuple(
            fc.constant(secret),
            fc.connection({ headers: fc.constant({ Cookie: `session=${cookieSignature.sign(sessionId, secret)}` }) }),
          ),
        ),
    ])('when the session store errors', async ([secret, connection]) => {
      const store: Store<JsonRecord> = {
        get() {
          throw 'get'
        },
        set() {
          throw 'set'
        },
        clear() {
          throw 'clear'
        },
        delete() {
          throw 'delete'
        },
      }
      const sessionStore = new Keyv({ store })

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left(new Error('get')))
    })
  })

  describe('storeSession', () => {
    test.prop([
      fc.tuple(fc.string(), fc.uuid()).chain(([secret, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `session=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.constant(sessionId),
          fc.dictionary(fc.lorem(), fc.lorem()),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])('when there is a session already', async ([secret, connection, sessionId, oldValue, newValue]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(sessionId, oldValue)

      const actual = await runMiddleware(_.storeSession(newValue)({ secret, sessionStore }), connection)()

      expect(await sessionStore.get(sessionId)).toStrictEqual(newValue)
      expect(actual).toStrictEqual(E.right([]))
    })

    test.prop([fc.string(), fc.connection<HeadersOpen>(), fc.dictionary(fc.lorem(), fc.lorem())])(
      "when there isn't a session already",
      async (secret, connection, value) => {
        const sessionStore = new Keyv()
        const spy = jest.spyOn(sessionStore, 'set')

        const actual = await runMiddleware(_.storeSession(value)({ secret, sessionStore }), connection)()

        expect(spy).toHaveBeenCalledWith(expect.anything(), value)
        expect(actual).toStrictEqual(
          E.right([
            {
              type: 'setCookie',
              name: 'session',
              value: cookieSignature.sign(spy.mock.calls[0][0], secret),
              options: {
                httpOnly: true,
              },
            },
          ]),
        )
      },
    )

    test.prop([
      fc.tuple(fc.string(), fc.uuid()).chain(([secret, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `session=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])('when there the session store errors', async ([secret, connection, value]) => {
      const store: Store<JsonRecord> = {
        get() {
          throw 'get'
        },
        set() {
          throw 'set'
        },
        clear() {
          throw 'clear'
        },
        delete() {
          throw 'delete'
        },
      }
      const sessionStore = new Keyv({ store })

      const actual = await runMiddleware(_.storeSession(value)({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left(new Error('set')))
    })
  })

  describe('endSession', () => {
    test.prop([
      fc.tuple(fc.string(), fc.uuid()).chain(([secret, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `session=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.constant(sessionId),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])('when there is a session already', async ([secret, connection, sessionId, value]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(sessionId, value)

      const actual = await runMiddleware(_.endSession()({ secret, sessionStore }), connection)()

      expect(await sessionStore.has(sessionId)).toStrictEqual(false)
      expect(actual).toStrictEqual(
        E.right([
          {
            type: 'clearCookie',
            name: 'session',
            options: {
              httpOnly: true,
            },
          },
        ]),
      )
    })

    test.prop([fc.string(), fc.connection<HeadersOpen>()])(
      "when there isn't a session already",
      async (secret, connection) => {
        const sessionStore = new Keyv()

        const actual = await runMiddleware(_.endSession()({ secret, sessionStore }), connection)()

        expect(actual).toStrictEqual(E.right([]))
      },
    )

    test.prop([
      fc.tuple(fc.string(), fc.uuid()).chain(([secret, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `session=${cookieSignature.sign(sessionId, secret)}` }),
          }),
        ),
      ),
    ])('when the session store errors', async ([secret, connection]) => {
      const store: Store<JsonRecord> = {
        get() {
          throw 'get'
        },
        set() {
          throw 'set'
        },
        clear() {
          throw 'clear'
        },
        delete() {
          throw 'delete'
        },
      }
      const sessionStore = new Keyv({ store })

      const actual = await runMiddleware(_.endSession()({ secret, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left(new Error('delete')))
    })
  })
})
