import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { createLogger } from '../utils/logger'

const log = createLogger('route')

/** Renders nothing; logs every page change ("navigated to /login"). Place inside <BrowserRouter>. */
export function RouteLogger() {
  const { pathname } = useLocation()

  useEffect(() => {
    log.info(`navigated to ${pathname}`)
  }, [pathname])

  return null
}
