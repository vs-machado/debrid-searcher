import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { NextFunction, Request, Response } from 'express'
import { readEnv } from './config/env.js'
import { createApp } from './app.js'

const env = readEnv()
const app = createApp(env)

// Serve built web app if present.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist')
const webIndex = path.join(webDist, 'index.html')

if (fs.existsSync(webIndex)) {
  app.use(express.static(webDist))
  app.get(/^(?!\/api\/).*/, (_req: Request, res: Response, next: NextFunction) => {
    res.sendFile(webIndex, (err: unknown) => {
      if (err) next(err as any)
    })
  })
}

app.listen(env.port, '0.0.0.0', () => {
  console.log(`server listening on port ${env.port}`)
})
