terraform {
  backend "gcs" {
    bucket = "email-mamagement-app-tf-state-bucket"
    prefix = "terraform/state"
  }
}

# Enable Cloud Resource Manager API first
resource "google_project_service" "cloud_resource_manager" {
  project = var.project_id
  service = "cloudresourcemanager.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Enable other required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "pubsub.googleapis.com",
    "iap.googleapis.com",
    "oauth2.googleapis.com",
    "iam.googleapis.com"
  ])

  project = var.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy         = false

  depends_on = [google_project_service.cloud_resource_manager]

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Pub/Sub Topic
resource "google_pubsub_topic" "email_topic" {
  name    = var.pubsub_topic_name
  project = var.project_id

  depends_on = [google_project_service.required_apis["pubsub.googleapis.com"]]
}

# Pub/Sub Subscription
resource "google_pubsub_subscription" "email_subscription" {
  name    = var.pubsub_subscription_name
  topic   = google_pubsub_topic.email_topic.name
  project = var.project_id

  depends_on = [google_pubsub_topic.email_topic]
}

# IAP Brand
resource "google_iap_brand" "project_brand" {
  support_email     = var.service_account_email
  application_title = "Email Management System"
  project           = var.project_id

  depends_on = [google_project_service.required_apis["iap.googleapis.com"]]
}

# OAuth Client
resource "google_iap_client" "oauth_client" {
  display_name = var.oauth_client_name
  brand        = google_iap_brand.project_brand.name

  depends_on = [google_iap_brand.project_brand]
}

# Add IAM binding for the service account to publish to Pub/Sub
resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${var.service_account_email}"

  depends_on = [
    google_project_service.cloud_resource_manager,
    google_project_service.required_apis["iam.googleapis.com"]
  ]
}
