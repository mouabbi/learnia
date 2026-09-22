# Test guide — Auth Phase A (manual)

Goal: confirm each behavior works by hand. Tick each box when the result matches.
Automated tests come later (folder `18-testing`).

## Setup (two terminals, project root)

```bash
# Terminal 1: backend
cd backend
uv run alembic upgrade head              # creates the tables (safe to repeat)
uv run uvicorn learnia_backend.main:app --app-dir src --reload --port 8000

# Terminal 2: frontend
cd frontend
npm run dev                              # open the URL it prints (usually http://localhost:5173)
```
Use a fresh email for each register test (e.g. `test1@example.com`).

## A. In the browser

| # | Do | Expected | OK |
|---|---|---|---|
| 1 | Stop the backend, reload the page | "Server unreachable" + Retry button, no login form | [ ] |
| 2 | Start the backend, click Retry | The login page appears | [ ] |
| 3 | Open `/` while logged out | Redirected to `/login` | [ ] |
| 4 | Register with a 5-character password | Error message about 8 characters, no account created | [ ] |
| 5 | Register with valid email + 8+ char password | Lands on home, shows "Logged in as <email>" | [ ] |
| 6 | Reload the page (F5) | Still logged in (session cookie works) | [ ] |
| 7 | Click Log out | Back on `/login` | [ ] |
| 8 | After logout, open `/` | Redirected to `/login` again | [ ] |
| 9 | Register the same email again | "An account with this email already exists" | [ ] |
| 10 | Log in with a wrong password | "Invalid email or password" | [ ] |
| 11 | Log in with an email that doesn't exist | The SAME message as #10 (never reveals which emails exist) | [ ] |
| 12 | Log in with the correct password | Lands on home | [ ] |
| 13 | While logged in, type `/login` in the address bar (also `/register`) | Redirected straight to home, login form never shown | [ ] |
| 14 | Log out, then type `/` in the address bar | Redirected to `/login` (same as #3, rechecked after a real session) | [ ] |

## B. Check the cookie (browser DevTools)

F12 -> Application tab -> Cookies -> `learnia_session`:
- [ ] `HttpOnly` is checked (JavaScript cannot read it)
- [ ] `SameSite` is `Lax`
- [ ] The cookie disappears after you log out

## C. The API directly (optional, Git Bash)

```bash
curl -i http://127.0.0.1:8000/api/v1/health                 # 200 {"status":"ok"}
curl -i http://127.0.0.1:8000/api/v1/auth/me                # 401 (not logged in)
```
Or open http://127.0.0.1:8000/docs and try the endpoints from the page.

## D. Check the database

```bash
cd backend
uv run python -c "import sqlite3; c=sqlite3.connect('learnia.db'); print(c.execute('select id,email,substr(hashed_password,1,7) from users').fetchall())"
```
- [ ] Each user's password column starts with `$2b$` (a bcrypt hash), never the real password.

## If something fails

- Read the backend terminal and `backend/logs/app.log` first.
- Read the browser console (F12 -> Console) and Network tab (click the failing request).
- "Port already in use": stop the old server, or use `--port 8001` and change the port in `frontend/vite.config.js`.
- Reset the local data: delete `backend/learnia.db`, then run `uv run alembic upgrade head` again.

## Next: automate these

These manual cases become automated tests later. See [../18-testing/TEST-AUTOMATION-GUIDE.md](../18-testing/TEST-AUTOMATION-GUIDE.md) for the concepts and the learning order.
