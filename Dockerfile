# PB online: a stateless container that only serves the app. Nothing is written to disk.
FROM node:22-alpine
WORKDIR /pb
COPY server.mjs package.json ./
COPY app ./app
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
