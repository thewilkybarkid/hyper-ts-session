import * as E from 'fp-ts/Either'
import { HeadersOpen } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import Keyv from 'keyv'
import * as _ from '../src'
import * as fc from './fc'
import { runMiddleware } from './middleware'

describe('hyper-ts-session', () => {
  describe('constructors', () => {
    describe('getSession', () => {
      test('when there is a session', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid().chain(sessionId =>
              fc.tuple(
                fc.connection({
                  headers: fc.constant({ Cookie: `session=${sessionId}` }),
                }),
                fc.constant(sessionId),
                fc.dictionary(fc.lorem(), fc.lorem()),
              ),
            ),
            async ([connection, sessionId, value]) => {
              const sessionStore = new Keyv()
              await sessionStore.set(sessionId, value)

              const actual = await M.evalMiddleware(_.getSession()({ sessionStore }), connection)()

              expect(actual).toStrictEqual(E.right(value))
            },
          ),
        )
      })

      test("when there isn't a session", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.connection({
              headers: fc.record({ Cookie: fc.uuid().map(sessionId => `session=${sessionId}`) }),
            }),
            async connection => {
              const sessionStore = new Keyv()

              const actual = await M.evalMiddleware(_.getSession()({ sessionStore }), connection)()

              expect(actual).toStrictEqual(E.left('no-session'))
            },
          ),
        )
      })

      test('when the session cookie is not a session key', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.lorem({ maxCount: 1 }).chain(key =>
              fc.tuple(
                fc.connection({
                  headers: fc.constant({ Cookie: `session=${key}` }),
                }),
                fc.constant(key),
                fc.dictionary(fc.lorem(), fc.lorem()),
              ),
            ),
            async ([connection, key, value]) => {
              const sessionStore = new Keyv()
              await sessionStore.set(key, value)

              const actual = await M.evalMiddleware(_.getSession()({ sessionStore }), connection)()

              expect(actual).toStrictEqual(E.left('no-session'))
            },
          ),
        )
      })

      test('when there is no session cookie', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.connection({ headers: fc.record({ Cookie: fc.array(fc.cookie()) }, { withDeletedKeys: true }) }),
            async connection => {
              const sessionStore = new Keyv()

              const actual = await M.evalMiddleware(_.getSession()({ sessionStore }), connection)()

              expect(actual).toStrictEqual(E.left('no-session'))
            },
          ),
        )
      })
    })

    describe('storeSession', () => {
      test('when there is a session already', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.uuid().chain(sessionId =>
              fc.tuple(
                fc.connection<HeadersOpen>({
                  headers: fc.constant({ Cookie: `session=${sessionId}` }),
                }),
                fc.constant(sessionId),
                fc.dictionary(fc.lorem(), fc.lorem()),
                fc.dictionary(fc.lorem(), fc.lorem()),
              ),
            ),
            async ([connection, sessionId, oldValue, newValue]) => {
              const sessionStore = new Keyv()
              await sessionStore.set(sessionId, oldValue)

              const actual = await runMiddleware(_.storeSession(newValue)({ sessionStore }), connection)()

              expect(await sessionStore.get(sessionId)).toStrictEqual(newValue)
              expect(actual).toStrictEqual(E.right([]))
            },
          ),
        )
      })

      test("when there isn't a session already", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.connection<HeadersOpen>(),
            fc.dictionary(fc.lorem(), fc.lorem()),
            async (connection, value) => {
              const sessionStore = new Keyv()
              const spy = jest.spyOn(sessionStore, 'set')

              const actual = await runMiddleware(_.storeSession(value)({ sessionStore }), connection)()

              expect(spy).toHaveBeenCalledWith(expect.anything(), value)
              expect(actual).toStrictEqual(
                E.right([
                  {
                    type: 'setCookie',
                    name: 'session',
                    value: spy.mock.calls[0][0],
                    options: {},
                  },
                ]),
              )
            },
          ),
        )
      })
    })
  })
})
