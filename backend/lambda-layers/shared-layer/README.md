# Shared Lambda Layer

This Lambda layer contains common dependencies used across multiple Lambda functions in the email management system.

## Contents

The layer includes the following dependencies:

### AWS SDK Packages
- `@aws-sdk/client-cognito-identity-provider`: For Cognito user management
- `@aws-sdk/client-dynamodb`: For DynamoDB operations
- `@aws-sdk/lib-dynamodb`: For DynamoDB document client
- `@aws-sdk/client-ses`: For email sending via SES
- `@aws-sdk/client-apigatewaymanagementapi`: For WebSocket API Gateway operations
- `@aws-sdk/util-dynamodb`: For DynamoDB utilities
- `@aws-sdk/types`: For AWS SDK TypeScript types

### Google APIs
- `@googleapis/gmail`: For Gmail API operations

### Common Utilities
- `aws-jwt-verify`: For JWT verification
- `aws-lambda`: For Lambda function types
- `jwt-decode`: For JWT decoding

## Usage

1. Build the layer:
```bash
cd nodejs
npm ci
cd ..
npm run package
```

2. The layer is automatically attached to all Lambda functions in the infrastructure.

## Directory Structure
```
shared-layer/
├── nodejs/
│   ├── node_modules/     # Dependencies
│   └── package.json     # Layer dependencies
├── shared-layer.zip     # Packaged layer
└── README.md           # This file
```

## Notes
- The layer is compatible with Node.js 20.x runtime
- Dependencies are installed using `npm ci` for reproducible builds
- The layer is packaged using the `package` script in package.json 