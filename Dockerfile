FROM node:20

# Install ffmpeg
RUN apt update && apt install -y ffmpeg

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Expose port and run server
EXPOSE 8080
CMD ["npm", "start"]
