import { Request, Response } from 'express'
import * as fc from 'fast-check'
import * as H from 'hyper-ts'
import { ExpressConnection } from 'hyper-ts/lib/express'
import { Headers, createRequest, createResponse } from 'node-mocks-http'

export * from 'fast-check'

export const request = ({ headers }: { headers?: fc.Arbitrary<Headers> } = {}): fc.Arbitrary<Request> =>
  fc
    .record({
      headers: headers ?? fc.constant({}),
      url: fc.webUrl(),
    })
    .map(args =>
      Object.defineProperties(createRequest(args), { [fc.toStringMethod]: { value: () => fc.stringify(args) } }),
    )

export const response = (): fc.Arbitrary<Response> =>
  fc
    .record({ req: request() })
    .map(args =>
      Object.defineProperties(createResponse(args), { [fc.toStringMethod]: { value: () => fc.stringify(args) } }),
    )

export const connection = <S = H.StatusOpen>(...args: Parameters<typeof request>): fc.Arbitrary<ExpressConnection<S>> =>
  fc.tuple(request(...args), response()).map(args =>
    Object.defineProperties(new ExpressConnection(...args), {
      [fc.toStringMethod]: { value: () => fc.stringify(args[0]) },
    }),
  )

export const cookieName = (): fc.Arbitrary<string> => fc.lorem({ maxCount: 1 })

export const cookie = (): fc.Arbitrary<string> =>
  fc.tuple(cookieName(), fc.lorem({ maxCount: 1 })).map(([name, value]) => `${name}=${value}`)
