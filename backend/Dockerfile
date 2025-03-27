# Use official Node.js image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Copy the .env file into the container (make sure it's in your project)
COPY .env .env

# Start the application
CMD ["node", "server.js"]