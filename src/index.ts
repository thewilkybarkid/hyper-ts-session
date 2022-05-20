/**
 * @since 0.1.0
 */
import * as J from 'fp-ts/Json'
import { StatusOpen } from 'hyper-ts'
import * as RM from 'hyper-ts/lib/ReaderMiddleware'
import { Store } from 'keyv'

import JsonRecord = J.JsonRecord
import ReaderMiddleware = RM.ReaderMiddleware

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
export declare function getSession<I = StatusOpen>(): ReaderMiddleware<SessionEnv, I, I, 'no-session', JsonRecord>
