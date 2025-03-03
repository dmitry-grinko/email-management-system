variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_account_email" {
  description = "The service account email"
  type        = string
}

variable "pubsub_topic_name" {
  description = "Name of the Pub/Sub topic"
  type        = string
  default     = "email-management-topic"
}

variable "pubsub_subscription_name" {
  description = "Name of the Pub/Sub subscription"
  type        = string
  default     = "email-management-subscription"
}

variable "oauth_client_name" {
  description = "Name of the OAuth client"
  type        = string
  default     = "email-management-oauth-client"
} 