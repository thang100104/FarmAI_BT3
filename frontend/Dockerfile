FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    (npm ci --offline --no-audit --no-fund \
      && node -e "import('rolldown').then(() => import('lightningcss'))") \
    || NODE_OPTIONS=--dns-result-order=ipv4first npm ci --prefer-offline --no-audit --no-fund --maxsockets=5
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
