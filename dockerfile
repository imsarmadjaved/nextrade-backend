# Base image with Node + Python
FROM node:22-bullseye

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install Node dependencies
RUN npm ci

# Copy backend code
COPY . .

# Install Python dependencies
RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
