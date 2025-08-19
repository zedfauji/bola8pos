# Backend Deployment on Google Cloud Run

## Prerequisites
- GCP project with billing enabled
- Roles: Artifact Registry Admin, Cloud Run Admin, Cloud Build Editor, Service Account User
- gcloud CLI installed and authenticated: `gcloud auth login`
- Set default project: `gcloud config set project <PROJECT_ID>`

## One-time setup
```bash
# Enable APIs
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com

# Create Artifact Registry repository for images
REGION=us-central1
REPO=pos-artifacts
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="POS images" || true

# Grant Cloud Build access to deploy
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CLOUDBUILD_SA=$PROJECT_NUMBER@cloudbuild.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$CLOUDBUILD_SA \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$CLOUDBUILD_SA \
  --role=roles/iam.serviceAccountUser
```

## Build and deploy (Cloud Build)
From `pos/backend` directory:
```bash
# Submit build (customize substitutions if needed)
REGION=us-central1 REPO=pos-artifacts TAG=v1 \
  gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_REPO=$REPO,_TAG=$TAG
```
Cloud Build will:
- Build Docker image
- Push to Artifact Registry
- Deploy to Cloud Run service `pos-backend`

## Configure environment variables
```bash
SERVICE=pos-backend
REGION=us-central1
# Example
gcloud run services update $SERVICE \
  --region=$REGION \
  --set-env-vars=NODE_ENV=production \
  --min-instances=0 \
  --max-instances=1 \
  --memory=256Mi \
  --cpu=1 \
  --concurrency=80
```

## Verify
```bash
URL=$(gcloud run services describe pos-backend --region=us-central1 --format='value(status.url)')
curl -s $URL/health
```

## Local build/run (optional)
```bash
# Build
cd pos/backend
docker build -t pos-backend:local .
# Run
docker run --rm -p 8080:8080 pos-backend:local
```
