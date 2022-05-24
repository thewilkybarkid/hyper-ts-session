/**
 * @since 0.1.0
 */
import cookie from 'cookie'
import * as E from 'fp-ts/Either'
import * as J from 'fp-ts/Json'
import * as O from 'fp-ts/Option'
import * as RT from 'fp-ts/ReaderTask'
import * as r from 'fp-ts/Record'
import * as TE from 'fp-ts/TaskEither'
import { constVoid, flow, pipe } from 'fp-ts/function'
import { HeadersOpen, StatusOpen } from 'hyper-ts'
import * as M from 'hyper-ts/lib/Middleware'
import * as RM from 'hyper-ts/lib/ReaderMiddleware'
import * as D from 'io-ts/Decoder'
import { Store } from 'keyv'
import * as UUID from 'uuid-ts'

import JsonRecord = J.JsonRecord
import Middleware = M.Middleware
import ReaderMiddleware = RM.ReaderMiddleware
import ReaderTask = RT.ReaderTask
import Uuid = UUID.Uuid

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * @category model
 * @since 0.1.0
 */
export interface SessionEnv {
  sessionStore: Store<JsonRecord>
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
export function getSession<I = StatusOpen>(): ReaderMiddleware<SessionEnv, I, I, 'no-session', JsonRecord> {
  return pipe(
    RM.ask<SessionEnv, I>(),
    RM.chainMiddlewareK(({ sessionStore }) =>
      pipe(
        currentSessionId<I>(),
        M.chainTaskEitherKW(
          flow(
            TE.tryCatchK(async key => await sessionStore.get(key), constVoid),
            TE.chainOptionK(constVoid)(O.fromNullable),
          ),
        ),
        M.mapLeft(() => 'no-session'),
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
export function storeSession(session: JsonRecord): ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, never, void> {
  return pipe(
    RM.fromMiddleware(currentSessionId<HeadersOpen>()),
    RM.orElseMiddlewareK(newSession),
    RM.chainReaderTaskK(saveSession(session)),
  )
}

// -------------------------------------------------------------------------------------
// utils
// -------------------------------------------------------------------------------------

function currentSessionId<I = StatusOpen>(): Middleware<I, I, 'no-session', Uuid> {
  return pipe(
    getCookie<I>('session'),
    M.filterOrElse(UUID.isUuid, () => 'no-session'),
    M.mapLeft(() => 'no-session'),
  )
}

function newSession(): Middleware<HeadersOpen, HeadersOpen, never, Uuid> {
  return pipe(
    M.rightIO<HeadersOpen, never, Uuid>(UUID.v4()),
    M.chainFirst(sessionId =>
      M.cookie('session', sessionId, {
        httpOnly: true,
      }),
    ),
  )
}

function saveSession(session: JsonRecord): (key: Uuid) => ReaderTask<SessionEnv, void> {
  return key =>
    flow(
      TE.tryCatchK(async ({ sessionStore }: SessionEnv) => {
        await sessionStore.set(key, session)
      }, constVoid),
      TE.toUnion,
    )
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
