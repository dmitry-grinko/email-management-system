# Google APIs Lambda Layer

This Lambda layer contains the `googleapis` package and its dependencies for use in AWS Lambda functions.

## Contents

- `nodejs/node_modules/googleapis`: The googleapis package and its dependencies
- Version: ^129.0.0

## Usage

1. Deploy this layer to AWS Lambda
2. Attach the layer to your Lambda function
3. In your Lambda function code, you can now import googleapis:
   ```javascript
   const { google } = require('googleapis');
   ```

## Deployment

To deploy this layer:

1. Zip the contents:
   ```bash
   cd nodejs
   zip -r ../googleapis-layer.zip .
   ```

2. Upload the zip file to AWS Lambda as a layer

## Size Optimization

This layer has been created to optimize the size of Lambda functions that use the googleapis package by moving it to a shared layer. 