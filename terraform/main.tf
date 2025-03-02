data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  tags = {
    Environment = var.environment
    Name        = var.project-name
  }
}

data "aws_acm_certificate" "existing" {
  domain      = var.root-domain
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_route53_zone" "main" {
  name = var.root-domain
}

module "waf" {
  source             = "./modules/waf"
  waf_name           = "${var.project-name}-waf"
  waf_description    = "My WAF for the application"
  ip_set_name        = "blocked-ip-addresses"
  ip_set_description = "IP set for blocking specific IPs"
  blocked_ips        = ["192.0.2.0/32", "203.0.113.0/32"] # Replace with your IPs
}

module "cloudfront" {
  source                      = "./modules/cloud-front"
  website_domain              = "${var.subdomain-name}.${var.root-domain}"
  bucket_regional_domain_name = module.s3_frontend.bucket_regional_domain_name
  acm_certificate_arn         = data.aws_acm_certificate.existing.arn
  waf_arn                     = module.waf.waf_arn
  tags = {
    Environment = var.environment
  }
  depends_on = [module.waf]
}

module "s3_frontend" {
  source = "./modules/s3-frontend"

  bucket_name            = var.bucket-name
  environment            = var.environment
  cloudfront_oai_iam_arn = module.cloudfront.cloudfront_oai_iam_arn
}

module "s3_storage" {
  source = "./modules/s3-storage"

  bucket_name     = "${var.project-name}-storage-bucket"
  environment     = var.environment
  allowed_origins = ["https://${var.subdomain-name}.${var.root-domain}", "http://localhost:4200"]
}

resource "aws_route53_record" "static_website" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.subdomain-name}.${var.root-domain}"
  type    = "A"

  alias {
    name                   = module.cloudfront.cloudfront_distribution_domain_name
    zone_id                = module.cloudfront.cloudfront_distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

module "cognito" {
  source = "./modules/cognito"
  tags   = local.tags
}

module "api_gateway" {
  source = "./modules/api-gateway"

  allow_origins = ["https://${var.subdomain-name}.${var.root-domain}", "http://localhost:4200"]
  name        = "${var.project-name}-api"
  environment = var.environment
  tags        = local.tags

  integrations = {
    auth = {
      lambda_function_arn  = module.auth_lambda.function_arn
      lambda_function_name = module.auth_lambda.function_name
      routes = [
        {
          method = "POST"
          path   = "/auth/login"
        },
        {
          method = "POST"
          path   = "/auth/signup"
        },
        {
          method = "POST"
          path   = "/auth/resend-code"
        },
        {
          method = "POST"
          path   = "/auth/verify"
        },
        {
          method = "POST"
          path   = "/auth/refresh"
        },
        {
          method = "POST"
          path   = "/auth/logout"
        },
        {
          method = "POST"
          path   = "/auth/forgot-password"
        },
        {
          method = "POST"
          path   = "/auth/password-reset"
        },
        {
          method = "OPTIONS"
          path   = "/{proxy+}"
        }
      ]
    },
    user-data = {
      lambda_function_arn  = module.user_data_lambda.function_arn
      lambda_function_name = module.user_data_lambda.function_name
      routes = [
        {
          method = "GET"
          path   = "/user-data"
        },
        {
          method = "POST"
          path   = "/user-data"
        },
        {
          method = "PUT"
          path   = "/user-data"
        },
        {
          method = "DELETE"
          path   = "/user-data"
        }
      ]
    },
    webhook = {
      lambda_function_arn  = module.webhook_lambda.function_arn
      lambda_function_name = module.webhook_lambda.function_name
      routes = [
        {
          method = "POST"
          path   = "/webhook"
        }
      ]
    }
  }

  connection_lambda_arn = module.connection_lambda.function_arn
}

# Add Step Functions module
module "step_functions" {
  source                  = "./modules/step-functions"
  name                    = "${var.project-name}-ml-pipeline"
  tags                    = local.tags
  bucket_name             = module.s3_storage.bucket_id
  openai_lambda_arn       = module.openai_lambda.function_arn
  notion_lambda_arn       = module.notion_lambda.function_arn
  websocket_sns_topic_arn = module.sns-websocket-topic.topic_arn
}

