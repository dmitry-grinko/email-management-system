resource "aws_sfn_state_machine" "ml_pipeline" {
  name     = "${var.name}-ml-pipeline"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "Email Processing Pipeline with OpenAI and Notion"
    StartAt = "ProcessWithOpenAI"
    States = {
      ProcessWithOpenAI = {
        Type = "Task"
        Resource = var.openai_lambda_arn
        ResultPath = "$.openai_result"
        Next = "NotifyOpenAIComplete"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 30
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "NotifyError"
          }
        ]
      }
      NotifyOpenAIComplete = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "PIPELINE_STATUS"
            "data": {
              "step": "OpenAI"
              "status": "SUCCEEDED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
            }
          }
        }
        ResultPath = null
        Next = "ProcessWithNotion"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
      }
      ProcessWithNotion = {
        Type = "Task"
        Resource = var.notion_lambda_arn
        ResultPath = "$.notion_result"
        Next = "NotifyNotionComplete"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 30
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "NotifyError"
          }
        ]
      }
      NotifyNotionComplete = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "PIPELINE_STATUS"
            "data": {
              "step": "Notion"
              "status": "SUCCEEDED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
            }
          }
        }
        ResultPath = null
        End = true
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
      }
      NotifyError = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "PIPELINE_STATUS"
            "data": {
              "step.$": "$$.State.Name"
              "status": "FAILED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
              "error.$": "$.error"
              "cause.$": "$.cause"
            }
          }
        }
        ResultPath = null
        Next = "HandleError"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
      }
      HandleError = {
        Type = "Fail"
        Error = "StatesError"
        Cause = "Error handling pipeline execution"
      }
    }
  })

  logging_configuration {
    level = "ALL"
    include_execution_data = true
    log_destination = "${aws_cloudwatch_log_group.step_functions.arn}:*"
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "step_functions" {
  name              = "/aws/step-functions/${var.name}-ml-pipeline"
  retention_in_days = 14
  tags             = var.tags
}

# IAM role for Step Functions
resource "aws_iam_role" "step_functions_role" {
  name = "${var.name}-step-functions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM policy for Step Functions
resource "aws_iam_role_policy" "step_functions_policy" {
  name = "${var.name}-step-functions-policy"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          var.openai_lambda_arn,
          var.notion_lambda_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutLogEvents",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          var.websocket_sns_topic_arn
        ]
      }
    ]
  })
} 