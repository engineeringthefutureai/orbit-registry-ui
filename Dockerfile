# Static assets are architecture-independent; each per-arch Kaniko build
# produces an identical dist/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Pin by digest in practice: FROM nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:...
FROM nginxinc/nginx-unprivileged:stable-alpine-slim
# Defaults must be defined, or the entrypoint leaves ${...} literally in the config.
ENV REGISTRY_UPSTREAM=registry:5000 \
    REGISTRY_PUBLIC_URL=""
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
