FROM node:22-alpine AS builder
WORKDIR /build
COPY package.json tsconfig.json ./
COPY src/ src/
RUN npm install --ignore-scripts && npm run build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S mcp && adduser -S mcp -G mcp

COPY --from=builder /build/dist/ dist/
COPY --from=builder /build/node_modules/ node_modules/
COPY package.json ./

USER mcp

ENTRYPOINT ["node", "dist/index.js"]
