FROM node:20

RUN apt update && apt install -y ffmpeg

WORKDIR /app
COPY . .
RUN npm install

EXPOSE 8080
CMD ["npm", "start"]
