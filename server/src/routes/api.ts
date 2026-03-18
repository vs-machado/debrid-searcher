import { Router } from 'express'
import type { AppEnv } from '../config/env.js'
import { healthController } from '../controllers/healthController.js'
import { createSearchService } from '../services/searchService.js'
import { createTorboxService } from '../services/torboxService.js'
import { createSearchController } from '../controllers/searchController.js'
import { createTorboxAddController, createTorboxDownloadController } from '../controllers/torboxController.js'

export function createApiRouter(env: AppEnv) {
  const router = Router()

  const searchService = createSearchService(env)
  const torboxService = createTorboxService(env)

  router.get('/health', healthController)
  router.get('/search', createSearchController(searchService))
  router.post('/torbox/add', createTorboxAddController(torboxService))
  router.post('/torbox/download', createTorboxDownloadController(torboxService))

  return router
}
