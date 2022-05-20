import { expectTypeOf } from 'expect-type'
import { JsonRecord } from 'fp-ts/Json'
import { HeadersOpen, StatusOpen } from 'hyper-ts'
import * as RM from 'hyper-ts/lib/ReaderMiddleware'
import { Store } from 'keyv'
import * as _ from '../src'

import ReaderMiddleware = RM.ReaderMiddleware
import SessionEnv = _.SessionEnv

declare const sessionEnv: SessionEnv

//
// SessionEnv
//

expectTypeOf(sessionEnv.sessionStore).toEqualTypeOf<Store<JsonRecord>>()

//
// getSession
//

expectTypeOf(_.getSession()).toMatchTypeOf<
  ReaderMiddleware<SessionEnv, StatusOpen, StatusOpen, 'no-session', JsonRecord>
>()
expectTypeOf(_.getSession<HeadersOpen>()).toMatchTypeOf<
  ReaderMiddleware<SessionEnv, HeadersOpen, HeadersOpen, 'no-session', JsonRecord>
>()
