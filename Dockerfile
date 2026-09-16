FROM node:lts-alpine
ADD . /uno
RUN apk add nginx npm
WORKDIR /uno
RUN npm install
EXPOSE 8600/tcp
ENTRYPOINT ["node","server.js"]