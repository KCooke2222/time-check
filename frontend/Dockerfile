# Development image for the Vite frontend.
# Source is bind-mounted by docker-compose; node_modules stays inside the container.
FROM node:22-slim

ENV NODE_ENV=development

WORKDIR /app

# Install from the lockfile first so source edits do not invalidate this layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
