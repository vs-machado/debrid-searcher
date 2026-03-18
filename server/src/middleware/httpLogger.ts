import type { NextFunction, Request, Response } from 'express'
import { asArray, isRecord } from '../utils/object.js'
import { safeJsonForLog } from '../utils/log.js'

export function httpLogger(opts: { logBody: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = Date.now()

    const origJson = res.json.bind(res)
    ;(res as any).json = (body: unknown) => {
      ;(res as any).__jsonBody = body
      return origJson(body as any)
    }

    res.on('finish', () => {
      const ms = Date.now() - started
      const body = (res as any).__jsonBody as unknown

      let extra = ''
      if (isRecord(body)) {
        const results = asArray((body as any).results)
        if (results.length) {
          const cachedCount = results.filter((r) => isRecord(r) && (r as any).cached === true).length
          const errCount = asArray((body as any).errors).length
          extra = ` results=${results.length} cached=${cachedCount} errors=${errCount}`
        }
      }

      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)${extra}`)

      if (isRecord(body)) {
        const errors = asArray((body as any).errors)
        if (errors.length) {
          for (const e of errors.slice(0, 10)) {
            if (isRecord(e)) console.log(`error[${String((e as any).indexer ?? 'unknown')}]: ${String((e as any).message ?? (e as any).detail ?? '')}`)
            else console.log(`error: ${String(e)}`)
          }
          if (errors.length > 10) console.log(`... ${errors.length - 10} more error(s)`)
        }
      }

      if (opts.logBody && body !== undefined) console.log(safeJsonForLog(body))
    })

    next()
  }
}
