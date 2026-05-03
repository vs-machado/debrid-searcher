import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppEnv } from './config/env.js'
import { createApiRouter } from './routes/api.js'
import { httpLogger } from './middleware/httpLogger.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webDistPath = path.resolve(__dirname, '../../web/dist')

export function createApp(env: AppEnv) {
  const app = express()
  app.disable('x-powered-by')

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  if (env.logHttp) app.use('/api', httpLogger({ logBody: env.logHttpBody }))

  app.use('/api', createApiRouter(env))

  if (existsSync(webDistPath)) {
    app.use(express.static(webDistPath))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) {
        next()
        return
      }

      res.sendFile(path.join(webDistPath, 'index.html'))
    })
  }

  app.use(errorHandler())

  return app
}
