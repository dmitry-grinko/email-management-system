module "sns-websocket-topic" {
  source     = "./modules/sns-topic"
  topic_name = "${var.project-name}-websocket-topic"
  tags       = local.tags
}

# sns-websocket-topic invokes the websocket lambda
resource "aws_lambda_permission" "sns-websocket" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.websocket_lambda.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = module.sns-websocket-topic.topic_arn
}

# the websocket lambda subscribes to the sns-websocket-topic
resource "aws_sns_topic_subscription" "websocket_lambda_subscription" {
  topic_arn = module.sns-websocket-topic.topic_arn
  protocol  = "lambda"
  endpoint  = module.websocket_lambda.function_arn
}