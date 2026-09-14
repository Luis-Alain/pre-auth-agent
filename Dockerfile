FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
EXPOSE 3000 3001

CMD ["bun", "run", "--cwd", "client", "start"]
