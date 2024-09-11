import { test } from '@fast-check/jest'
import { describe, expect, jest } from '@jest/globals'
import cookieSignature from 'cookie-signature'
import * as E from 'fp-ts/Either'
import { HeadersOpen } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import Keyv, { KeyvStoreAdapter } from 'keyv'
import * as _ from '../src'
import * as fc from './fc'
import { runMiddleware } from './middleware'

describe('constructors', () => {
  describe('getSession', () => {
    test.prop([
      fc.tuple(fc.string(), fc.cookieName(), fc.uuid()).chain(([secret, sessionCookie, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.constant(sessionCookie),
          fc.connection({
            headers: fc.constant({ Cookie: `${sessionCookie}=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.constant(sessionId),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])('when there is a session', async ([secret, sessionCookie, connection, sessionId, value]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(sessionId, value)

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.right(value))
    })

    test.prop([
      fc.string(),
      fc.cookieName().chain(sessionCookie =>
        fc.tuple(
          fc.constant(sessionCookie),
          fc.connection({
            headers: fc.record({ Cookie: fc.uuid().map(sessionId => `${sessionCookie}=${sessionId}`) }),
          }),
        ),
      ),
    ])("when there isn't a session", async (secret, [sessionCookie, connection]) => {
      const sessionStore = new Keyv()

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left('no-session'))
    })

    test.prop([
      fc.string(),
      fc
        .tuple(fc.cookieName(), fc.lorem({ maxCount: 1 }))
        .chain(([sessionCookie, key]) =>
          fc.tuple(
            fc.constant(sessionCookie),
            fc.connection({ headers: fc.constant({ Cookie: `session=${key}` }) }),
            fc.constant(key),
            fc.dictionary(fc.lorem(), fc.lorem()),
          ),
        ),
    ])('when the session cookie is not a session key', async (secret, [sessionCookie, connection, key, value]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(key, value)

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left('no-session'))
    })

    test.prop([
      fc.string(),
      fc.cookieName(),
      fc.connection({ headers: fc.record({ Cookie: fc.array(fc.cookie()) }, { withDeletedKeys: true }) }),
    ])('when there is no session cookie', async (secret, sessionCookie, connection) => {
      const sessionStore = new Keyv()

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left('no-session'))
    })

    test.prop([
      fc.tuple(fc.string(), fc.cookieName(), fc.uuid()).chain(([secret, sessionCookie, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.constant(sessionCookie),
          fc.connection({
            headers: fc.constant({ Cookie: `${sessionCookie}=${cookieSignature.sign(sessionId, secret)}` }),
          }),
        ),
      ),
    ])('when the session store errors', async ([secret, sessionCookie, connection]) => {
      const store: KeyvStoreAdapter = {
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
        on() {
          return this
        },
        opts: undefined,
      }
      const sessionStore = new Keyv({ store })

      const actual = await M.evalMiddleware(_.getSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left(new Error('get')))
    })
  })

  describe('storeSession', () => {
    test.prop([
      fc.tuple(fc.string(), fc.cookieName(), fc.uuid()).chain(([secret, sessionCookie, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.constant(sessionCookie),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `${sessionCookie}=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.constant(sessionId),
          fc.dictionary(fc.lorem(), fc.lorem()),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])(
      'when there is a session already',
      async ([secret, sessionCookie, connection, sessionId, oldValue, newValue]) => {
        const sessionStore = new Keyv()
        await sessionStore.set(sessionId, oldValue)

        const actual = await runMiddleware(
          _.storeSession(newValue)({ secret, sessionCookie, sessionStore }),
          connection,
        )()

        expect(await sessionStore.get(sessionId)).toStrictEqual(newValue)
        expect(actual).toStrictEqual(E.right([]))
      },
    )

    test.prop([fc.string(), fc.cookieName(), fc.connection<HeadersOpen>(), fc.dictionary(fc.lorem(), fc.lorem())])(
      "when there isn't a session already",
      async (secret, sessionCookie, connection, value) => {
        const sessionStore = new Keyv()
        const spy = jest.spyOn(sessionStore, 'set')

        const actual = await runMiddleware(_.storeSession(value)({ secret, sessionCookie, sessionStore }), connection)()

        expect(spy).toHaveBeenCalledWith(expect.anything(), value)
        expect(actual).toStrictEqual(
          E.right([
            {
              type: 'setCookie',
              name: sessionCookie,
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
      fc.tuple(fc.string(), fc.cookieName(), fc.uuid()).chain(([secret, sessionCookie, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.constant(sessionCookie),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `${sessionCookie}=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])('when there the session store errors', async ([secret, sessionCookie, connection, value]) => {
      const store: KeyvStoreAdapter = {
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
        on() {
          return this
        },
        opts: undefined,
      }
      const sessionStore = new Keyv({ store })

      const actual = await runMiddleware(_.storeSession(value)({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left(new Error('set')))
    })
  })

  describe('endSession', () => {
    test.prop([
      fc.tuple(fc.string(), fc.cookieName(), fc.uuid()).chain(([secret, sessionCookie, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.constant(sessionCookie),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `${sessionCookie}=${cookieSignature.sign(sessionId, secret)}` }),
          }),
          fc.constant(sessionId),
          fc.dictionary(fc.lorem(), fc.lorem()),
        ),
      ),
    ])('when there is a session already', async ([secret, sessionCookie, connection, sessionId, value]) => {
      const sessionStore = new Keyv()
      await sessionStore.set(sessionId, value)

      const actual = await runMiddleware(_.endSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(await sessionStore.has(sessionId)).toStrictEqual(false)
      expect(actual).toStrictEqual(
        E.right([
          {
            type: 'clearCookie',
            name: sessionCookie,
            options: {
              httpOnly: true,
            },
          },
        ]),
      )
    })

    test.prop([fc.string(), fc.cookieName(), fc.connection<HeadersOpen>()])(
      "when there isn't a session already",
      async (secret, sessionCookie, connection) => {
        const sessionStore = new Keyv()

        const actual = await runMiddleware(_.endSession()({ secret, sessionCookie, sessionStore }), connection)()

        expect(actual).toStrictEqual(E.right([]))
      },
    )

    test.prop([
      fc.tuple(fc.string(), fc.cookieName(), fc.uuid()).chain(([secret, sessionCookie, sessionId]) =>
        fc.tuple(
          fc.constant(secret),
          fc.constant(sessionCookie),
          fc.connection<HeadersOpen>({
            headers: fc.constant({ Cookie: `${sessionCookie}=${cookieSignature.sign(sessionId, secret)}` }),
          }),
        ),
      ),
    ])('when the session store errors', async ([secret, sessionCookie, connection]) => {
      const store: KeyvStoreAdapter = {
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
        on() {
          return this
        },
        opts: undefined,
      }
      const sessionStore = new Keyv({ store })

      const actual = await runMiddleware(_.endSession()({ secret, sessionCookie, sessionStore }), connection)()

      expect(actual).toStrictEqual(E.left(new Error('delete')))
    })
  })
})
