# Use an official Python runtime as a parent image
FROM python:3.13-slim

# Set the working directory in the container
WORKDIR /app

# LibGL.so.1 is missing
# https://stackoverflow.com/questions/55313610/importerror-libgl-so-1-cannot-open-shared-object-file-no-such-file-or-directo
RUN apt-get update && apt-get install ffmpeg libsm6 libxext6  -y

# https://stackoverflow.com/questions/66602656/no-module-named-numpy-during-docker-build
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel   

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir pytoon

# Install FastAPI and Uvicorn and other dependencies
RUN pip install --no-cache-dir fastapi uvicorn python-multipart moviepy==1.0.3 audioop-lts==0.2.1

# Install NLTK data
RUN python -m nltk.downloader punkt averaged_perceptron_tagger averaged_perceptron_tagger_eng cmudict words

# Copy the rest of the application code into the container
COPY . .

# Expose the port the API will run on
EXPOSE 7017

# Define the command to run the application
# Replace 'main:app' with your FastAPI app's entry point
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7017"]