
FROM node:20-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libc6 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p data auth_info
ENV NODE_ENV=production
ENV TRANSFORMERS_CACHE=/app/data/transformers
EXPOSE 3512
CMD ["node", "bot.js"]
