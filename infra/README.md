# Deployment (Google Cloud)

This project is configured to deploy the backend and frontend to Cloud Run via Cloud Build.

Prerequisites
- Google Cloud project with billing enabled
- Artifact Registry repository (substitution `_REPO`)
- Cloud Build and Cloud Run APIs enabled
- PostgreSQL and Redis provisioned (Cloud SQL + Memorystore recommended)

Setup
1. Create Artifact Registry repo:
   - `gcloud artifacts repositories create pos-artifacts --repository-format=docker --location=us-central1`
2. Grant Cloud Build to deploy to Cloud Run:
   - `gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com --role=roles/run.admin`
   - `gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com --role=roles/iam.serviceAccountUser`
3. Configure substitutions in `cloudbuild.yaml` for DB/Redis URLs and backend URL.

Deploy
- From repo root:
  - `gcloud builds submit --config cloudbuild.yaml .`

Environment Variables
- Backend:
  - `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME`
  - `REDIS_HOST, REDIS_PORT`
  - `JWT_SECRET`
- Frontend:
  - `VITE_API_URL` should point to `https://<backend-service>-<hash>-<region>.a.run.app/api`
  - `VITE_WS_URL` should point to the backend host for Socket.IO

Local Development
- `docker-compose up -d` to run Postgres, Redis, backend (port 5000), and frontend (port 3000)

Notes
- Consider using Cloud SQL Auth Proxy for secure DB access from Cloud Run, or place services in a VPC with Serverless VPC Access.
- Replace placeholder URLs in `cloudbuild.yaml` substitutions before running the build.