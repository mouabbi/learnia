"""Request logging middleware: one log line per request, saying who sent it."""

import logging
import time
from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import FastAPI, Request, Response

logger = logging.getLogger("learnia_backend.request")


def _classify_source(request: Request) -> tuple[str, str]:
    """
    Guess who sent the request, from headers the client chooses to send
    (so this is for debugging, never for security decisions: any client can fake them).

    Returns (source, referer_without_query). Sources:
      docs            -> the Swagger page served by FastAPI itself (/docs, /redoc)
      frontend        -> a browser page on ANOTHER address than the API (e.g. the
                         React app on localhost:5173, forwarded by the Vite proxy)
      browser-direct  -> a browser talking to the API's address with no page context
                         (typing an API URL in the address bar)
      script          -> curl, Postman, Python...: no browser User-Agent
    """
    user_agent = request.headers.get("user-agent", "")
    # Origin is sent on POST/PUT/DELETE; Referer on most page-triggered requests.
    page_url = request.headers.get("referer") or request.headers.get("origin") or ""
    page = urlsplit(page_url)
    referer = f"{page.scheme}://{page.netloc}{page.path}" if page.netloc else ""

    if "Mozilla" not in user_agent:
        return "script", referer
    if page.netloc and page.path.startswith(("/docs", "/redoc")):
        return "docs", referer
    if page.netloc and page.netloc != request.headers.get("host"):
        return "frontend", referer
    return "browser-direct", referer


def register_request_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def log_requests(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # request.client is the direct caller's address. Uvicorn swaps in X-Forwarded-For
        # when a trusted local proxy sets it. Through the Vite proxy this is 127.0.0.1.
        host = request.client.host if request.client else "unknown"
        source, referer = _classify_source(request)

        # Only paths are logged, never query strings (they can hold sensitive values).
        logger.info(
            "%s %s %s -> %d (%.0f  ms) | source=%s referer=%s ",
            host,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            source,
            referer or "-",
        )
        return response
