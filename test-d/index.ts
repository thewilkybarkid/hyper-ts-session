import { expectTypeOf } from 'expect-type'
import { JsonRecord } from 'fp-ts/Json'
import { HeadersOpen, StatusOpen } from 'hyper-ts'
import * as RM from 'hyper-ts/lib/ReaderMiddleware'
import Keyv from 'keyv'
import * as _ from '../src'

import ReaderMiddleware = RM.ReaderMiddleware
import SessionEnv = _.SessionEnv

declare const sessionEnv: SessionEnv
declare const jsonRecord: JsonRecord

//
// SessionEnv
//

expectTypeOf(sessionEnv.sessionStore).toEqualTypeOf<Keyv<JsonRecord>>()

//
// getSession
//

expectTypeOf(_.getSession()).toMatchTypeOf<
  ReaderMiddleware<SessionEnv, StatusOpen, StatusOpen, 'no-session', JsonRecord>
>()
expectTypeOf(_.getSession<HeadersOpen>()).toMatchTypeOf<
  ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, 'no-session', JsonRecord>
>()

//
// storeSession
//

expectTypeOf(_.storeSession(jsonRecord)).toMatchTypeOf<
  ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, never, void>
>()

//
// endSession
//

expectTypeOf(_.endSession()).toMatchTypeOf<ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, never, void>>()
