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

# Download and install Cloud SQL Proxy
RUN curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 && \
    chmod +x cloud_sql_proxy && \
    mv cloud_sql_proxy /usr/local/bin/
# Expose the port and start the server
EXPOSE 5000
CMD /usr/local/bin/cloud_sql_proxy -dir=/cloudsql -instances=$CLOUD_SQL_CONNECTION_NAME & node server.js