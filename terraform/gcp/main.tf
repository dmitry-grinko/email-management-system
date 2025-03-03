terraform {
  backend "gcs" {
    bucket = "email-mamagement-app-tf-state-bucket"
    prefix = "terraform/state"
  }
}

# Pub/Sub Topic
resource "google_pubsub_topic" "email_topic" {
  name    = var.pubsub_topic_name
  project = var.project_id
}

# Pub/Sub Subscription
resource "google_pubsub_subscription" "email_subscription" {
  name    = var.pubsub_subscription_name
  topic   = google_pubsub_topic.email_topic.name
  project = var.project_id
}

# IAP Brand
resource "google_iap_brand" "project_brand" {
  support_email     = var.service_account_email
  application_title = "Email Management System"
  project           = var.project_id
}

# OAuth Client
resource "google_iap_client" "oauth_client" {
  display_name = var.oauth_client_name
  brand        = google_iap_brand.project_brand.name
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "pubsub.googleapis.com",
    "iap.googleapis.com",
    "oauth2.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com"
  ])

  project = var.project_id
  service = each.key

  disable_on_destroy = false
}

# Add IAM binding for the service account to publish to Pub/Sub
resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${var.service_account_email}"
}
