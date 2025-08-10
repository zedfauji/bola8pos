terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  # Use GOOGLE_APPLICATION_CREDENTIALS env; do not read file() to avoid path issues
}

data "google_project" "current" {}

locals {
  backend_image  = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo}/pos-backend:${var.tag}"
  frontend_image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.repo}/pos-frontend:${var.tag}"
  run_service_account = "bola8posiac@bola8pos.iam.gserviceaccount.com"
}

# Enable required services
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com"
  ])
  service            = each.value
  disable_on_destroy = false
}

# Artifact Registry repository for images
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repo
  format        = "DOCKER"
  depends_on    = [google_project_service.services]
}

# Allow Cloud Run runtime SA to pull images
resource "google_artifact_registry_repository_iam_member" "repo_reader" {
  location   = var.region
  repository = google_artifact_registry_repository.repo.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${local.run_service_account}"
}

# Cloud Run backend
resource "google_cloud_run_v2_service" "backend" {
  count    = var.deploy_backend ? 1 : 0
  name     = "pos-backend"
  location = var.region

  template {
    service_account = local.run_service_account
    containers {
      image = local.backend_image
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
  }

  ingress = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  depends_on = [google_artifact_registry_repository.repo]
}

resource "google_cloud_run_v2_service_iam_binding" "backend_public" {
  count    = var.deploy_backend ? 1 : 0
  name     = google_cloud_run_v2_service.backend[0].name
  location = var.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

# Cloud Run frontend
resource "google_cloud_run_v2_service" "frontend" {
  count    = var.deploy_frontend ? 1 : 0
  name     = "pos-frontend"
  location = var.region

  template {
    service_account = local.run_service_account
    containers {
      image = local.frontend_image
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
  }

  ingress = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  depends_on = [google_artifact_registry_repository.repo]
}

resource "google_cloud_run_v2_service_iam_binding" "frontend_public" {
  count    = var.deploy_frontend ? 1 : 0
  name     = google_cloud_run_v2_service.frontend[0].name
  location = var.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

output "backend_url" {
  value       = var.deploy_backend ? google_cloud_run_v2_service.backend[0].uri : null
  description = "URI of backend service (null if not deployed)"
}

output "frontend_url" {
  value       = var.deploy_frontend ? google_cloud_run_v2_service.frontend[0].uri : null
  description = "URI of frontend service (null if not deployed)"
}


