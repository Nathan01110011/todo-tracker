import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import placesHandler from './api/places'
import photosHandler from './api/photos'
import testEnvHandler from './api/test-env'

const apiHandlers = {
  '/api/places': placesHandler,
  '/api/photos': photosHandler,
  '/api/test-env': testEnvHandler,
}

const readBody = (req: any) => new Promise((resolve, reject) => {
  const chunks: Buffer[] = []

  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('error', reject)
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks).toString()

    if (!rawBody) {
      resolve(undefined)
      return
    }

    try {
      resolve(JSON.parse(rawBody))
    } catch {
      resolve(rawBody)
    }
  })
})

const createVercelResponse = (res: any) => {
  let statusCode = 200

  return {
    status(code: number) {
      statusCode = code
      return this
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value)
      return this
    },
    json(data: unknown) {
      res.statusCode = statusCode
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    },
    send(data: unknown) {
      res.statusCode = statusCode
      res.end(data)
    },
  }
}

const localApiPlugin = (): Plugin => ({
  name: 'local-api-routes',
  configureServer(server) {
    Object.entries(apiHandlers).forEach(([path, handler]) => {
      server.middlewares.use(path, async (req, res) => {
        try {
          req.body = await readBody(req)
          await handler(req as any, createVercelResponse(res) as any)
        } catch (error) {
          console.error(`Local API error for ${path}:`, error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Local API route failed.' }))
        }
      })
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [localApiPlugin(), react()],
  }
})
