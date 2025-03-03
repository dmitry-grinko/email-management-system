variable "name" {
  description = "Name prefix for all resources"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
}

variable "openai_lambda_arn" {
  description = "ARN of the Process Data Lambda function"
  type        = string
}

variable "notion_lambda_arn" {
  description = "ARN of the Save Model Lambda function"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 bucket for model storage"
  type        = string
}

variable "websocket_sns_topic_arn" {
  description = "ARN of the SNS topic for websocket notifications"
  type        = string
} 