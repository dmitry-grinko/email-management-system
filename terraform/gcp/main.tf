terraform {
  backend "gcs" {
    bucket = "email-mamagement-app-tf-state-bucket"
    prefix = "terraform/state"
  }
}

# Grant required roles to the service account
resource "google_project_iam_member" "service_usage_admin" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = "serviceAccount:${var.service_account_email}"
}

resource "google_project_iam_member" "service_management_admin" {
  project = var.project_id
  role    = "roles/servicemanagement.admin"
  member  = "serviceAccount:${var.service_account_email}"
}

resource "google_project_iam_member" "service_management_consumer" {
  project = var.project_id
  role    = "roles/servicemanagement.serviceConsumer"
  member  = "serviceAccount:${var.service_account_email}"
}

# Add a time delay for IAM propagation
resource "time_sleep" "wait_for_iam" {
  depends_on = [
    google_project_iam_member.service_usage_admin,
    google_project_iam_member.service_management_admin,
    google_project_iam_member.service_management_consumer
  ]

  create_duration = "30s"
}

# Enable fundamental APIs first
resource "google_project_service" "fundamental_apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "servicemanagement.googleapis.com",
    "serviceusage.googleapis.com"
  ])

  project = var.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy         = false

  depends_on = [time_sleep.wait_for_iam]

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Add a time delay for API enablement propagation
resource "time_sleep" "wait_for_apis" {
  depends_on = [google_project_service.fundamental_apis]

  create_duration = "30s"
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

  depends_on = [time_sleep.wait_for_apis]

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
    google_project_service.fundamental_apis,
    google_project_service.required_apis["iam.googleapis.com"]
  ]
}
