# Use an official Node.js runtime as a parent image.
# The 'alpine' variant is a good choice for production as it's much smaller.
FROM node:latest

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock, etc.)
# This step is separate to leverage Docker's layer caching.
# It will only re-run if these files change.
COPY package*.json ./

# Install app dependencies
# Using --omit=dev to not install devDependencies in a production image
RUN npm install --omit=dev

# Bundle app source
COPY . .

# The application listens on port 3000 by default, expose it
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "server.js" ]