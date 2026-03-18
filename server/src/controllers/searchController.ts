import type { Request, Response } from 'express'
import { searchQuerySchema } from '../schemas/searchSchemas.js'
import type { SearchService } from '../services/searchService.js'

export function createSearchController(searchService: SearchService) {
  return async (req: Request, res: Response) => {
    const { q } = searchQuerySchema.parse(req.query)
    const out = await searchService.search(q)
    res.json(out)
  }
}
