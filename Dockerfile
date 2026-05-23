# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Install ONLY production deps so socket.io is available to our custom server.
# We do NOT use Next's standalone output because it ships its own server.js
# which would overwrite our custom Socket.io-aware server.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts and our custom server
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["node", "server.js"]
