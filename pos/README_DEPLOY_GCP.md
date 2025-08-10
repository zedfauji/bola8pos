# Deploy POS to Google Cloud Run (free-tier friendly)

Services
- Backend: `pos/backend` → Cloud Run (minInstances=0, maxInstances=1, 256Mi)
- Frontend: `pos/frontend` → Cloud Run (minInstances=0, maxInstances=1, 128Mi)
- Artifact Registry stores container images

Prerequisites
- Google Cloud project with billing enabled
- gcloud CLI authenticated: `gcloud auth login`
- Default project set or provide `-ProjectId`

One-time enablement
```powershell
$ProjectId = 'YOUR_PROJECT_ID'
$Region = 'us-central1'
$Repo = 'pos-artifacts'

gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create $Repo --repository-format=docker --location=$Region --description "POS images" 2>$null || echo 'Repo exists'

$ProjectNumber = gcloud projects describe $ProjectId --format='value(projectNumber)'
$CbSa = "$ProjectNumber@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $ProjectId --member=serviceAccount:$CbSa --role=roles/run.admin
gcloud projects add-iam-policy-binding $ProjectId --member=serviceAccount:$CbSa --role=roles/iam.serviceAccountUser
```

Deploy backend
```powershell
cd pos/backend
$subs = "_REGION=$Region,_REPO=$Repo,_TAG=v1"
gcloud builds submit --config cloudbuild.yaml --substitutions $subs
$BackendUrl = gcloud run services describe pos-backend --region $Region --format='value(status.url)'
```

Deploy frontend (binds to backend URL)
```powershell
cd ../frontend
$subs = "_REGION=$Region,_REPO=$Repo,_TAG=v1,_API_URL=$BackendUrl"
gcloud builds submit --config cloudbuild.yaml --substitutions $subs
$FrontendUrl = gcloud run services describe pos-frontend --region $Region --format='value(status.url)'
```

Notes
- Frontend build requires `VITE_API_URL` substitution; Cloud Build config passes `_API_URL` for this.
- For Firestore, backend supports ADC or `FIREBASE_CREDENTIALS` file path.
- Free tier: both services scale to zero by default.

Terraform (IaC) option
1) Ensure images are built and pushed with the desired tag (see Cloud Build steps above)
2) Install Terraform, then from `iac/terraform`:
```powershell
terraform init
terraform apply -auto-approve -var "project_id=YOUR_PROJECT_ID" -var "region=us-central1" -var "repo=pos-artifacts" -var "tag=v1"
```
3) Outputs will include the service URLs.
