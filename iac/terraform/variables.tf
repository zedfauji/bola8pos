variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "bola8pos"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "repo" {
  description = "Artifact Registry repository id"
  type        = string
  default     = "pos-artifacts"
}

variable "tag" {
  description = "Docker image tag"
  type        = string
  default     = "v1"
}

variable "credentials_file" {
  description = "Path to service account JSON (optional)"
  type        = string
  default     = "pos/bola8pos-ae745ab65345.json"
}

variable "deploy_frontend" {
  description = "Whether to deploy the frontend service"
  type        = bool
  default     = true
}

variable "deploy_backend" {
  description = "Whether to deploy the backend service"
  type        = bool
  default     = true
}


