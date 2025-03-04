terraform {
  backend "gcs" {
    bucket = "email-mamagement-app-tf-state-bucket"
    prefix = "terraform/state"
  }
}

# Get the existing project
data "google_project" "project" {
  project_id = var.project_id
}

# Enable Service Management API first
resource "google_project_service" "service_management_api" {
  project = data.google_project.project.project_id
  service = "servicemanagement.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Wait for Service Management API to be enabled
resource "time_sleep" "wait_service_management" {
  depends_on      = [google_project_service.service_management_api]
  create_duration = "30s"
}

# Grant required roles to the service account
resource "google_project_iam_member" "service_management_admin" {
  project    = data.google_project.project.project_id
  role       = "roles/servicemanagement.admin"
  member     = "serviceAccount:${var.service_account_email}"
  depends_on = [time_sleep.wait_service_management]
}

# Enable Service Usage API
resource "google_project_service" "service_usage_api" {
  project = data.google_project.project.project_id
  service = "serviceusage.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false

  depends_on = [google_project_iam_member.service_management_admin]

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Wait for Service Usage API to be enabled
resource "time_sleep" "wait_service_usage" {
  depends_on      = [google_project_service.service_usage_api]
  create_duration = "30s"
}

resource "google_project_iam_member" "service_usage_admin" {
  project    = data.google_project.project.project_id
  role       = "roles/serviceusage.serviceUsageAdmin"
  member     = "serviceAccount:${var.service_account_email}"
  depends_on = [time_sleep.wait_service_usage]
}

# Enable IAM API
resource "google_project_service" "iam_api" {
  project = data.google_project.project.project_id
  service = "iam.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false

  depends_on = [google_project_iam_member.service_usage_admin]

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Wait for IAM API to be enabled
resource "time_sleep" "wait_iam_api" {
  depends_on      = [google_project_service.iam_api]
  create_duration = "30s"
}

resource "google_project_iam_member" "project_iam_admin" {
  project    = data.google_project.project.project_id
  role       = "roles/resourcemanager.projectIamAdmin"
  member     = "serviceAccount:${var.service_account_email}"
  depends_on = [time_sleep.wait_iam_api]
}

# Add a time delay for all IAM propagation
resource "time_sleep" "wait_for_iam" {
  depends_on = [
    google_project_iam_member.service_management_admin,
    google_project_iam_member.service_usage_admin,
    google_project_iam_member.project_iam_admin
  ]
  create_duration = "60s"
}

# Enable Cloud Resource Manager API
resource "google_project_service" "cloudresourcemanager_api" {
  project = data.google_project.project.project_id
  service = "cloudresourcemanager.googleapis.com"

  disable_dependent_services = false
  disable_on_destroy         = false

  depends_on = [time_sleep.wait_for_iam]

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Wait for all fundamental APIs
resource "time_sleep" "wait_for_apis" {
  depends_on = [
    google_project_service.service_management_api,
    google_project_service.service_usage_api,
    google_project_service.iam_api,
    google_project_service.cloudresourcemanager_api
  ]
  create_duration = "60s"
}

# Enable other required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "pubsub.googleapis.com",
    "iap.googleapis.com",
    "oauth2.googleapis.com"
  ])

  project = data.google_project.project.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy         = false

  depends_on = [time_sleep.wait_for_apis]

  timeouts {
    create = "30m"
    update = "40m"
  }
}

# Add a time delay for API enablement propagation
resource "time_sleep" "wait_for_required_apis" {
  depends_on      = [google_project_service.required_apis]
  create_duration = "30s"
}

# Pub/Sub Topic
resource "google_pubsub_topic" "email_topic" {
  name    = var.pubsub_topic_name
  project = data.google_project.project.project_id

  depends_on = [
    time_sleep.wait_for_required_apis,
    google_project_service.required_apis["pubsub.googleapis.com"]
  ]
}

# Pub/Sub Subscription
resource "google_pubsub_subscription" "email_subscription" {
  name    = var.pubsub_subscription_name
  topic   = google_pubsub_topic.email_topic.name
  project = data.google_project.project.project_id

  expiration_policy {
    ttl = "" # Never expire
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s" # 10 minutes
  }

  depends_on = [google_pubsub_topic.email_topic]
}

# IAP Brand
resource "google_iap_brand" "project_brand" {
  support_email     = var.service_account_email
  application_title = "Email Management System"
  project           = data.google_project.project.project_id

  depends_on = [
    time_sleep.wait_for_required_apis,
    google_project_service.required_apis["iap.googleapis.com"]
  ]

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion of IAP brand
  }
}

# OAuth Client
resource "google_iap_client" "oauth_client" {
  display_name = var.oauth_client_name
  brand        = google_iap_brand.project_brand.name

  depends_on = [google_iap_brand.project_brand]
}

# Add IAM binding for the service account to publish to Pub/Sub
resource "google_project_iam_member" "pubsub_publisher" {
  project = data.google_project.project.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${var.service_account_email}"

  depends_on = [
    google_project_service.iam_api,
    time_sleep.wait_for_iam
  ]
}
