# Build from the repo root so the contract schema is copied in (compose.yaml sets the context).
FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY docs/contracts/cmai-export/cmai-export.schema.json ./contract/cmai-export.schema.json
USER node
EXPOSE 8787
CMD ["node", "src/index.mjs"]
