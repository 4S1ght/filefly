// Imports ====================================================================

import url           from 'url'
import path          from 'path'
import http          from 'http'
import https         from 'https'
import express       from 'express'
import Config        from '../config/config.js'
import SSL           from './ssl/ssl.js'
import logging       from '../logging/logging.js'
import bodyParser    from 'body-parser'
import cookieParser  from 'cookie-parser'
import requestLogger from './middleware/requestLogger.js'

const out = logging.getScope(import.meta.url)

const __filename = url.fileURLToPath(import.meta.url)
const __dirname  = url.fileURLToPath(new URL('.', import.meta.url))

// Types ======================================================================

export type TMiddleware     = (req: express.Request, res: express.Response, next: express.NextFunction) => any
export type TRequestHandler = (req: express.Request, res: express.Response) => any

// Endpoints ==================================================================

// ==== POST HANDLERS ====
import newSession from './_post/newSession.js'

// Code =======================================================================

export default class HttpServer {

    public  static $: HttpServer
    private static app = express()
    private static server: http.Server | https.Server
    private static clientApp = path.join(__dirname, '../../../client')

    public static start(): EavSingleAsync {
        return new Promise(async finish => {
            try {
                
                if (Config.$.use_https) {
                    await SSL.init()
                    const [certError, sslData] = await SSL.getSSLCertKeyData()
                    if (certError) throw certError

                    const options: https.ServerOptions = { ...sslData }
                    this.server = https.createServer(options, this.app)

                    out.INFO(`Network protocol: https`)
                }
                else {
                    this.server = http.createServer(this.app)
                    out.WARN(`Network protocol: http`)
                }
                
                this.finishAPISetup()
        
                this.server.listen(Config.$.http_port, () => {
                    out.INFO(`Listening on port ${Config.$.http_port}`)
                    finish(undefined)
                })

            } 
            catch (error) {
                finish(error as Error)
            }
        })
    }

    private static finishAPISetup() {

        // Only run static server in deployment, in development, Svelte dev server proxy is used for the API access
        process.env.NODE_ENV === 'production' && this.app.use(express.static(this.clientApp))
        const router = express.Router({ mergeParams: false })

        this.app.use(bodyParser.json())
        this.app.use(cookieParser())
        this.app.use(requestLogger.logger)
        this.app.use('/api/v1', router)

        router.post('/session/new', newSession)



    }

}