# Base image with Node + Debian (good for Python)
FROM node:22-bullseye

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory
WORKDIR /app

# Copy Node.js dependencies first
COPY package*.json ./

# Install Node dependencies
RUN npm ci

# Copy all project files
COPY . .

# Install Python dependencies
RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
