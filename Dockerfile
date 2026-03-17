# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (workspaces: web + server)
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/tsconfig.json server/
RUN npm ci

# Build web (static assets)
COPY web/ web/
RUN npm --prefix web run build

# Build server (TypeScript -> JS)
COPY server/src/ server/src/
RUN npm --prefix server run build

# ---- production stage ----
FROM node:22-alpine
WORKDIR /app

# Install only server runtime deps (no workspaces needed)
COPY server/package.json server/
RUN cd server && npm install --omit=dev

# Copy built artifacts
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist

ENV NODE_ENV=production
ENV PORT=5174
EXPOSE 5174

CMD ["node", "server/dist/index.js"]
