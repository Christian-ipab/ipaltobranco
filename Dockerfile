FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "backend/server.js"]
