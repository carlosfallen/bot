# FILE: Dockerfile
# Multi-stage build otimizado para Bun + Baileys

FROM oven/bun:1.1-debian AS base
WORKDIR /app

# Instalar dependências do sistema necessárias para Baileys
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Stage de dependências
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Stage de build
FROM base AS build
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage final
FROM base AS runtime

# Criar usuário não-root
RUN groupadd -r imperio && useradd -r -g imperio imperio

# Copiar dependências e build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY package.json ./

# Copiar e ajustar permissões ANTES de mudar usuário
RUN chown -R imperio:imperio /app

# Mudar para usuário não-root
USER imperio

# Criar diretórios necessários como usuário imperio
RUN mkdir -p /app/data /app/sessions /app/logs

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3210
ENV TZ=America/Fortaleza

EXPOSE 3210

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3210/api/health || exit 1

# Comando de inicialização
CMD ["bun", "run", "src/index.tsx"]
