/**
 * @since 0.1.0
 */
import cookie from 'cookie'
import cookieSignature from 'cookie-signature'
import * as E from 'fp-ts/Either'
import * as J from 'fp-ts/Json'
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as r from 'fp-ts/Record'
import * as TE from 'fp-ts/TaskEither'
import { flow, pipe } from 'fp-ts/function'
import { HeadersOpen, StatusOpen } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import * as RM from 'hyper-ts/lib/ReaderMiddleware'
import * as D from 'io-ts/Decoder'
import Keyv from 'keyv'
import * as UUID from 'uuid-ts'

import JsonRecord = J.JsonRecord
import Middleware = M.Middleware
import ReaderMiddleware = RM.ReaderMiddleware
import ReaderTaskEither = RTE.ReaderTaskEither
import Uuid = UUID.Uuid

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * @category model
 * @since 0.1.0
 */
export interface SessionEnv {
  secret: string
  sessionCookie: string
  sessionStore: Keyv
}

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * Returns a middleware that returns the current session.
 *
 * @category constructors
 * @since 0.1.0
 */
export function getSession<I = StatusOpen>(): ReaderMiddleware<SessionEnv, I, I, 'no-session' | Error, JsonRecord> {
  return pipe(
    RM.ask<SessionEnv, I>(),
    RM.chain(({ sessionStore }) =>
      pipe(
        currentSessionId<I>(),
        RM.chainTaskEitherKW(
          flow(
            TE.tryCatchK(async key => await sessionStore.get(key), E.toError),
            TE.chainEitherKW(E.fromNullable('no-session' as const)),
          ),
        ),
      ),
    ),
  )
}

/**
 * Returns a middleware that stores a value in a session.
 *
 * @category constructors
 * @since 0.1.0
 */
export function storeSession(session: JsonRecord): ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, Error, void> {
  return pipe(currentSessionId<HeadersOpen>(), RM.orElse(newSession), RM.chainReaderTaskEitherK(saveSession(session)))
}

/**
 * Returns a middleware that ends the current session.
 *
 * @category constructors
 * @since 0.1.2
 */
export function endSession(): ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, Error, void> {
  return pipe(
    RM.ask<SessionEnv, HeadersOpen>(),
    RM.chain(({ sessionCookie }) =>
      RM.clearCookie(sessionCookie ?? 'session', {
        httpOnly: true,
      }),
    ),
    RM.chain(() => currentSessionId<HeadersOpen>()),
    RM.chainReaderTaskEitherKW(deleteSession),
    RM.orElseW(error => (error === 'no-session' ? RM.right(undefined) : RM.left(error))),
  )
}

// -------------------------------------------------------------------------------------
// utils
// -------------------------------------------------------------------------------------

function currentSessionId<I = StatusOpen>(): ReaderMiddleware<SessionEnv, I, I, 'no-session', Uuid> {
  return pipe(
    RM.ask<SessionEnv, I>(),
    RM.chainMiddlewareK(({ sessionCookie, secret }) =>
      pipe(
        getCookie<I>(sessionCookie),
        M.chainEitherKW(E.fromNullableK(() => 'no-session')(value => cookieSignature.unsign(value, secret) || null)),
        M.filterOrElseW(UUID.isUuid, () => 'no-session'),
        M.mapLeft(() => 'no-session'),
      ),
    ),
  )
}

function newSession(): ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, never, Uuid> {
  return pipe(
    RM.ask<SessionEnv, HeadersOpen>(),
    RM.chainMiddlewareK(({ sessionCookie, secret }) =>
      pipe(
        M.rightIO<HeadersOpen, never, Uuid>(UUID.v4()),
        M.chainFirst(sessionId =>
          M.cookie(sessionCookie, cookieSignature.sign(sessionId, secret), {
            httpOnly: true,
          }),
        ),
      ),
    ),
  )
}

function saveSession(session: JsonRecord): (key: Uuid) => ReaderTaskEither<SessionEnv, Error, void> {
  return key =>
    TE.tryCatchK(async ({ sessionStore }: SessionEnv) => {
      await sessionStore.set(key, session)
    }, E.toError)
}

function deleteSession(key: Uuid): ReaderTaskEither<SessionEnv, Error, void> {
  return TE.tryCatchK(async ({ sessionStore }: SessionEnv) => {
    await sessionStore.delete(key)
  }, E.toError)
}

function getCookie<I = StatusOpen>(name: string): Middleware<I, I, 'no-cookie', string> {
  return pipe(
    getCookies<I>(),
    M.chainEitherKW(E.fromOptionK(() => 'no-cookie')(r.lookup(name))),
    M.mapLeft(() => 'no-cookie'),
  )
}

function getCookies<I = StatusOpen>(): Middleware<I, I, 'no-cookies', Record<string, string>> {
  return M.decodeHeader(
    'Cookie',
    flow(
      D.string.decode,
      E.bimap(() => 'no-cookies', cookie.parse),
    ),
  )
}
