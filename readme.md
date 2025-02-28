# Email Management System 

## Description

This repository is created to demonstrate the integration capabilities of OpenAI and Notion API. The idea is that when a user copies a specific email, pastes it into our frontend input, and clicks the 'Parse' button, the system parses this text and saves it in a specific table in our Notion app.

## Stack

Angular 19, AWS Lambda, S3, Terraform, Github Actions

## Architecture

![Architecture](https://raw.githubusercontent.com/dmitry-grinko/email-management-system/refs/heads/main/image.png)


## TODO

#### Frontend:
- Setup Angular app ✅
- Environment Variables
- Create auth components ✅
- Auth Guards
- Interceptor for API Headers
- Notion API Service
- S3 Service
- User Data Service
- OpenAI Service
- Notification Service (API Gateway websockets)

#### Backend:
- AWS Congnito Authorization
- S3Lambda
- DataPreparationLambda
- OpenAILambda
- User Data Lambda
- NotionAPILambda

#### Infrastructure:
- S3 bucket for the terraform state ✅
- S3 bucket terraform module for frontend
- S3 bucket terraform module to store emails
- API GW module terraform module
- CloudFront terraform module
- Cognito terraform module
- Step Functions terraform module
- WAF terraform module
- Lambda terraform module

#### CI/CD:
- Github Actions pipeline ✅
- Github Actions secrets ✅
- Script to update environment variables for Angular