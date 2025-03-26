#!/bin/bash

# Set variables
PROJECT_ID=your-gcp-project-id
SERVICE_NAME=billiard-pos
REGION=us-central1

# Authenticate with GCP
gcloud auth login

# Set project
gcloud config set project $PROJECT_ID

# Build and push backend image
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME-backend ./backend

# Deploy backend to Cloud Run
gcloud run deploy $SERVICE_NAME-backend --image gcr.io/$PROJECT_ID/$SERVICE_NAME-backend --platform managed --region $REGION --allow-unauthenticated

# Build and push frontend image
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend ./frontend

# Deploy frontend to Cloud Run
gcloud run deploy $SERVICE_NAME-frontend --image gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend --platform managed --region $REGION --allow-unauthenticated

echo "Deployment complete!"
