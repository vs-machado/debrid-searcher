import { Router } from 'express'
import type { AppEnv } from '../config/env.js'
import { healthController } from '../controllers/healthController.js'
import { createAuthLoginController, createAuthLogoutController, createAuthMeController } from '../controllers/authController.js'
import { createSearchService } from '../services/searchService.js'
import { createTorboxService } from '../services/torboxService.js'
import { createAuthService } from '../services/authService.js'
import { createSearchController } from '../controllers/searchController.js'
import { createTorboxAddController, createTorboxDownloadController } from '../controllers/torboxController.js'
import { requireAuth } from '../middleware/requireAuth.js'

export function createApiRouter(env: AppEnv) {
  const router = Router()

  const authService = createAuthService(env)
  const searchService = createSearchService(env)
  const torboxService = createTorboxService(env)

  router.get('/health', healthController)
  router.post('/auth/login', createAuthLoginController(authService))
  router.post('/auth/logout', createAuthLogoutController(authService))
  router.get('/auth/me', createAuthMeController(authService))

  router.use(requireAuth(authService))
  router.get('/search', createSearchController(searchService))
  router.post('/torbox/add', createTorboxAddController(torboxService))
  router.post('/torbox/download', createTorboxDownloadController(torboxService))

  return router
}
