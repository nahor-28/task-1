FROM node:24-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN mkdir -p uploads
EXPOSE 5000
CMD ["pnpm", "run", "dev"]
