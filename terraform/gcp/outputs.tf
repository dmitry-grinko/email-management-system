output "pubsub_topic_id" {
  description = "The ID of the Pub/Sub topic"
  value       = google_pubsub_topic.email_topic.id
}

output "pubsub_subscription_id" {
  description = "The ID of the Pub/Sub subscription"
  value       = google_pubsub_subscription.email_subscription.id
}

output "oauth_client_id" {
  description = "The OAuth client ID"
  value       = google_iap_client.oauth_client.client_id
}

output "oauth_client_secret" {
  description = "The OAuth client secret"
  value       = google_iap_client.oauth_client.secret
  sensitive   = true
} 