# BlueprintAI frontend - static build served by nginx
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# API base baked at build time; backend is published on the host at :8000
# with every route under /api (in production CloudFront routes /api/* to the
# backend, so the deployed build uses VITE_API_BASE=/api)
ARG VITE_API_BASE=http://localhost:8000/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
