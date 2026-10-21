FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
