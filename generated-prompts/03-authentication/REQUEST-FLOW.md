# How a request travels (Vite, FastAPI, cookies)

## 1. Two servers, two ports

| Server | Address | Job |
|---|---|---|
| Vite (frontend) | `http://localhost:5173` | serves the React page, and forwards `/api/...` to FastAPI |
| FastAPI (backend) | `http://127.0.0.1:8000` | the real API: login, sessions, database |

The browser only ever talks to **Vite**. The page calls a *relative* URL like
`/api/v1/auth/me`, so the browser sends it to the site it is on (`localhost:5173`).
Vite sees `/api`, and **forwards** the request to FastAPI (`proxy` in `vite.config.js`).

```
Browser --/api/v1/auth/me--> Vite :5173 --forward--> FastAPI :8000
Browser <------ response ---- Vite       <---------- FastAPI
                (+ Set-Cookie passes back through unchanged)
```

## 2. Why the log shows 127.0.0.1 (and not "the browser")

FastAPI only sees the **direct caller**: whoever opened the TCP connection to port 8000.

- Through the page: the caller is **Vite** (running on your machine) -> `127.0.0.1`.
- `curl http://127.0.0.1:8000/...` directly: the caller is **curl** -> `127.0.0.1` too.

Both look identical in the log line, because both come from your own computer and Vite
adds no "who was the original client" header by default. So the log host cannot
tell "via Vite" from "direct". Two ways to tell them apart:

- **Referer / Origin header**: a browser page sends `Referer: http://localhost:5173/...`; curl sends nothing.
- **`xfwd: true`** in the Vite proxy config: Vite then adds `X-Forwarded-For` (the browser's
  address) and `X-Forwarded-Host` (`localhost:5173`). Uvicorn already uses `X-Forwarded-For`
  for `request.client.host`, so the log would show the browser's address.
  (Optional change; on your own machine the browser address is also `127.0.0.1` or `::1`.)

In production, the same idea applies with nginx/AWS in front of FastAPI: the log would show
the proxy's address unless the proxy forwards the real client address in `X-Forwarded-For`.

## 3. How the cookie gets from FastAPI to the browser and back

1. **Login**: browser -> Vite -> FastAPI. FastAPI answers with the header
   `Set-Cookie: learnia_session=...; HttpOnly; SameSite=lax`.
2. Vite passes the response (headers included) back untouched.
3. The **browser stores the cookie for the site it used: `localhost`** (the address in the
   URL bar), not for "FastAPI".
4. **Every later request** to `localhost` (`/api/v1/auth/me`, ...) makes the browser attach
   `Cookie: learnia_session=...` **automatically**. Vite forwards that header unchanged, and
   FastAPI looks up the session in the database.

`HttpOnly` means JavaScript cannot read the cookie, but the browser still sends it.
Your React code never touches the session token.

## 4. Why the proxy makes it work (and what breaks without it)

Because the page and `/api/...` share one address (`localhost:5173`), everything is
**same-origin**: no CORS, and cookies just work.

If the React page instead called `http://127.0.0.1:8000/...` directly, that would be a
**different origin**: the browser would need CORS headers, `credentials: 'include'` on every
fetch, and the cookie would be stored for `127.0.0.1` instead. That is why the code uses a
relative path.

## 5. "Different client" cases (the confusing part)

Cookies belong to a **host name**, not to a port or a tool.

| You do | Cookie used | Result |
|---|---|---|
| Use the app at `http://localhost:5173` | the `localhost` cookie | logged in |
| Open `http://127.0.0.1:5173` instead | `127.0.0.1` is a **different host** than `localhost`: separate cookie jar | you look logged out; log in again there |
| Open `http://localhost:8000/docs`, log in | cookies ignore the port: same `localhost` jar as the app | the app also becomes logged in |
| Open `http://127.0.0.1:8000/docs`, log in | the `127.0.0.1` jar | the app at `localhost:5173` is NOT affected |
| `curl` | none automatically | not logged in unless you use `-c cookies.txt` (save) and `-b cookies.txt` (send) |

Also: `localhost` can resolve to IPv6 `::1`, while `127.0.0.1` is IPv4. Vite may listen only on
`::1`, which is why `curl http://127.0.0.1:5173` can fail while `http://localhost:5173` works.

## 6. Quick experiments

```bash
# Via Vite (the path the browser uses): no cookie -> 401
curl -i http://localhost:5173/api/v1/auth/me

# Directly to FastAPI: same answer, same 127.0.0.1 in the log
curl -i http://127.0.0.1:8000/api/v1/auth/me

# Keep a cookie across curl calls
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' \
  http://localhost:5173/api/v1/auth/login/password
curl -b cookies.txt http://localhost:5173/api/v1/auth/me     # now 200
```
Watch `backend/logs/app.log` while you run them.
