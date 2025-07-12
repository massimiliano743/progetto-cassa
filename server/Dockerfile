FROM node:18-bullseye

# Installa tutte le dipendenze necessarie per Puppeteer
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Installa Puppeteer con le dipendenze
RUN npm install --unsafe-perm --omit=dev

COPY . .

CMD ["npm", "start"]
