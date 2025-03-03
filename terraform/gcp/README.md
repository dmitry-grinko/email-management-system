# GCP Infrastructure

This directory contains Terraform configuration for GCP infrastructure setup.

## Required GitHub Actions Secret

You need to set up the following secret in your GitHub repository:

- `GOOGLE_APPLICATION_CREDENTIALS`: The service account JSON key content

The workflow will:
1. Extract from service account JSON:
   - Project ID
   - Service Account Email
2. Use default values for:
   - Region: "us-central1"
   - Resource names (based on project ID)

## Infrastructure Components

The configuration creates:
1. Pub/Sub topic and subscription for message handling
2. OAuth client for authentication
3. Required IAM permissions
4. Necessary GCP APIs enabled

## CI/CD Pipeline

The GitHub Actions workflow:
1. Extracts project ID and service account email from credentials
2. Sets default values for region and resource names
3. Applies infrastructure changes
4. Saves generated OAuth credentials as environment variables for other workflows

## Variables

Variables are set in the following ways:
- From service account JSON:
  - `TF_VAR_project_id`: From project_id field
  - `TF_VAR_service_account_email`: From client_email field
- Default values:
  - `TF_VAR_region`: "us-central1"
  - `TF_VAR_pubsub_topic_name`: "${project_id}-topic"
  - `TF_VAR_pubsub_subscription_name`: "${project_id}-subscription"
  - `TF_VAR_oauth_client_name`: "${project_id}-oauth-client" 