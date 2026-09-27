# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Learnia frontend — MULTI-STAGE build:
#   stage 1 "build": Node installs packages and runs `vite build` -> dist/
#   stage 2:         nginx serves only those static files
# The final image contains NO Node and NO node_modules (~50MB instead of ~500MB).
# ---------------------------------------------------------------------------

# ===== Stage 1: build the React app =====
FROM node:22-alpine AS build
WORKDIR /app

# Same caching trick as the backend: dependencies first...
COPY package.json package-lock.json ./
# `npm ci` = exact versions from package-lock.json (reproducible builds).
RUN --mount=type=cache,target=/root/.npm npm ci

# ...then the source code.
COPY . .

# Vite reads VITE_* variables at BUILD time and writes them into the JS.
# "/api/v1" is relative, so the browser calls the same host it loaded the
# page from — nginx (stage 2) forwards those calls to the backend.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_LOG_LEVEL=warn
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_LOG_LEVEL=$VITE_LOG_LEVEL
RUN npm run build

# ===== Stage 2: serve it with nginx =====
FROM nginx:1.27-alpine

# Our site config replaces nginx's default one.
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Take ONLY the built files from stage 1.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# (no CMD needed: the nginx image already starts nginx in the foreground)
