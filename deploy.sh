#!/bin/bash

# Set Google Cloud Project ID
PROJECT_ID="bola8pos"
REGION="us-central1"
SQL_INSTANCE="billiard-pos-db"
DB_NAME="billiard_pos"
DB_USER="postgres"
DB_PASS="SkycatchDrone@*1"
REPO_NAME="billiard-pos-repo"
BACKEND_SERVICE="billiard-pos-backend"
FRONTEND_DIR="./frontend"

# Exit immediately if a command exits with a non-zero status
set -e

log() {
    echo "[$TIMESTAMP] $1"
}

log "🚀 Starting deployment script..."

# === SET GOOGLE CLOUD PROJECT ===
log "🔧 Setting Google Cloud Project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# === ENABLE REQUIRED SERVICES ===
log "⚡ Enabling required GCP services..."
gcloud services enable compute.googleapis.com sqladmin.googleapis.com \
    artifactregistry.googleapis.com run.googleapis.com \
    cloudbuild.googleapis.com firebase.googleapis.com
log "✅ GCP services enabled."

# === CREATE CLOUD SQL INSTANCE ===
if ! gcloud sql instances describe $SQL_INSTANCE > /dev/null 2>&1; then
    log "📦 Creating Cloud SQL instance: $SQL_INSTANCE"
    gcloud sql instances create $SQL_INSTANCE \
        --database-version=POSTGRES_13 \
        --tier=db-f1-micro \
        --region=$REGION \
        --root-password=$DB_PASS \
        --network=default \
        --async
    log "⏳ Waiting for Cloud SQL instance to be ready..."
    sleep 180  # Wait for 3 minutes to ensure it's ready
else
    log "✅ Cloud SQL instance already exists, skipping creation."
fi

# === CREATE DATABASE & USER ===
log "🔑 Setting up Cloud SQL database..."
gcloud sql databases create $DB_NAME --instance=$SQL_INSTANCE || log "⚠️ Database already exists, skipping."
gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password=$DB_PASS || log "⚠️ User already exists, skipping."

# === CREATE ARTIFACT REGISTRY FOR DOCKER IMAGES ===
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION > /dev/null 2>&1; then
    log "📦 Creating Artifact Registry: $REPO_NAME"
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION
else
    log "✅ Artifact Registry already exists, skipping creation."
fi

# === BUILD & PUSH BACKEND IMAGE TO ARTIFACT REGISTRY ===
log "🐳 Configuring Docker authentication for Artifact Registry..."
gcloud auth configure-docker $REGION-docker.pkg.dev

log "🐳 Building & pushing backend Docker image..."
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$BACKEND_SERVICE ./backend

# === DEPLOY BACKEND TO CLOUD RUN ===
log "🚀 Deploying Backend to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE \
    --image=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$BACKEND_SERVICE \
    --region=$REGION \
    --platform=managed \
    --allow-unauthenticated \
    --add-cloudsql-instances=$PROJECT_ID:$REGION:$SQL_INSTANCE \
    --set-env-vars=DB_HOST=/cloudsql/$PROJECT_ID:$REGION:$SQL_INSTANCE,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASS,DB_NAME=$DB_NAME,REDIS_HOST="$REDIS_HOST",REDIS_PORT="$REDIS_PORT"

log "✅ Backend successfully deployed to Cloud Run!"

# === DEPLOY FRONTEND TO FIREBASE HOSTING ===
log "🌎 Deploying Frontend to Firebase..."
cd $FRONTEND_DIR
npm install

log "⚡ Building frontend..."
npm run build

log "🔑 Setting Firebase authentication..."
echo "$FIREBASE_SA_KEY" > firebase-key.json
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/firebase-key.json"

log "🚀 Deploying frontend to Firebase Hosting..."
firebase deploy --project=$PROJECT_ID

log "✅ Frontend successfully deployed to Firebase Hosting!"