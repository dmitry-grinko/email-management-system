# Google APIs Lambda Layer
resource "aws_lambda_layer_version" "shared" {
  filename            = "../../backend/lambda-layers/shared-layer/shared-layer.zip"
  layer_name          = "${var.project-name}-shared"
  compatible_runtimes = ["nodejs20.x"]
  description         = "Shared layer containing Gmail API dependency"
  source_code_hash    = filebase64sha256("../../backend/lambda-layers/shared-layer/shared-layer.zip")
}

module "auth_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-auth-lambda"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/auth/auth-lambda.zip"
  tags               = local.tags

  additional_policies = [
  ]

  environment_variables = {
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.client_id
  }

  depends_on = [module.cognito]
}

module "user_data_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-user-data"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/user-data/user-data-lambda.zip"
  tags               = local.tags
  layers             = [aws_lambda_layer_version.shared.arn]

  additional_policies = [
    {
      name = "dynamodb-user-data-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:BatchGetItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:UpdateItem"
            ]
            Resource = [
              module.dynamodb_user_data.table_arn,
              "${module.dynamodb_user_data.table_arn}/index/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    USER_DATA_TABLE         = module.dynamodb_user_data.table_name
    COGNITO_USER_POOL_ID    = module.cognito.user_pool_id
    GOOGLE_CLOUD_TOPIC_NAME = var.google_cloud_topic_name
  }

  depends_on = [module.dynamodb_user_data]
}

module "connection_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-connection"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/connection/connection-lambda.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-connections-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:PutItem",
              "dynamodb:DeleteItem",
              "dynamodb:GetItem",
              "dynamodb:UpdateItem",
              "dynamodb:Query"
            ]
            Resource = [
              module.dynamodb_user_data.table_arn,
              "${module.dynamodb_user_data.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "execute-api"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "execute-api:ManageConnections"
            ]
            Resource = [
              "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    CONNECTIONS_TABLE      = module.dynamodb_user_data.table_name
    WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
  }

  depends_on = [module.dynamodb_user_data]
}

module "websocket_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-websocket"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/websocket/websocket-lambda.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-connections-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:Query"
            ]
            Resource = [
              module.dynamodb_user_data.table_arn,
              "${module.dynamodb_user_data.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "execute-api"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "execute-api:ManageConnections"
            ]
            Resource = [
              "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    CONNECTIONS_TABLE      = module.dynamodb_user_data.table_name
    WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
  }

  depends_on = [
    module.dynamodb_user_data,
    aws_apigatewayv2_api.websocket,
    aws_apigatewayv2_stage.websocket
  ]
}

module "openai_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-openai"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/openai/openai-lambda.zip"
  tags               = local.tags

  additional_policies = []

  environment_variables = {}

  depends_on = []
}

module "notion_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-notin"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/notion/notion-lambda.zip"
  tags               = local.tags

  additional_policies = []

  environment_variables = {}

  depends_on = []
}

module "consumer_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-consumer-lambda"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/consumer/consumer-lambda.zip"
  tags               = local.tags

  additional_policies = []

  environment_variables = {}

  depends_on = []
}

module "webhook_lambda" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-webhook"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../../backend/lambdas/webhook/webhook-lambda.zip"
  tags               = local.tags

  additional_policies = []

  environment_variables = {}

  depends_on = []
}