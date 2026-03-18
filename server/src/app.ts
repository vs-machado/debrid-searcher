import express from 'express'
import cors from 'cors'
import type { AppEnv } from './config/env.js'
import { createApiRouter } from './routes/api.js'
import { httpLogger } from './middleware/httpLogger.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp(env: AppEnv) {
  const app = express()
  app.disable('x-powered-by')

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  if (env.logHttp) app.use('/api', httpLogger({ logBody: env.logHttpBody }))

  app.use('/api', createApiRouter(env))
  app.use(errorHandler())

  return app
}
