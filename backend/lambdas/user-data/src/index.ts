import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { jwtDecode } from 'jwt-decode';
import { google } from 'googleapis'; // We have a lambda layer for it. Added as a dev dependency.

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = process.env.USER_DATA_TABLE!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Id-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,DELETE'
};

async function registerGmailWatch(accessToken: string, userId: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  const gmail = google.gmail({ version: 'v1', auth });
  
  const response = await gmail.users.watch({
    userId,
    requestBody: {
      labelIds: ['INBOX'],
      topicName: `email-management-system-topic`
    }
  });

  return response.data;
}

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult> => {
  // Handle OPTIONS requests for CORS
  if ('httpMethod' in event && event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  let idToken: string | undefined;
  let accessToken: string | undefined;
  
  try {
    idToken = event.headers['x-id-token'] || event.headers['X-Id-Token'];
    accessToken = event.headers.authorization?.replace('Bearer ', '');
  } catch (error) {
    console.error('Error parsing headers:', error);
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid headers' })
    };
  }

  if (!idToken || !accessToken) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unauthorized. Missing required tokens.' })
    };
  }

  // Decode and validate both tokens
  const idTokenPayload = jwtDecode(idToken);
  const accessTokenPayload = jwtDecode(accessToken);

  if (!idTokenPayload || !accessTokenPayload) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unauthorized. Invalid tokens.' })
    };
  }

  // Verify token claims
  const now = Math.floor(Date.now() / 1000);
  if (
    !idTokenPayload.sub ||
    !idTokenPayload.exp ||
    !accessTokenPayload.exp ||
    idTokenPayload.exp < now ||
    accessTokenPayload.exp < now
  ) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unauthorized. Tokens expired or invalid.' })
    };
  }

  // Verify tokens are from your Cognito user pool
  if (
    idTokenPayload.iss !== `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}` ||
    accessTokenPayload.iss !== `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}`
  ) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unauthorized. Invalid token issuer.' })
    };
  }

  const userId = idTokenPayload.sub;

  try {
    const method = 'httpMethod' in event ? event.httpMethod : event.requestContext.http.method;
    
    switch (method) {
      case 'POST': {
        let body;
        try {
          body = JSON.parse('body' in event ? event.body! : event.body || '{}');
        } catch (error) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Invalid request body' })
          };
        }

        // Check if this is a token save operation
        const isTokenSave = body.access_token && body.refresh_token;

        // Create update expression and attribute values dynamically
        let updateExpression = 'SET';
        const expressionAttributeNames: { [key: string]: string } = {};
        const expressionAttributeValues: { [key: string]: any } = {};
        
        // Process each field in the body
        Object.entries(body).forEach(([key, value], index) => {
          const attributeName = `#attr${index}`;
          const attributeValue = `:val${index}`;
          
          updateExpression += `${index === 0 ? '' : ','} ${attributeName} = ${attributeValue}`;
          expressionAttributeNames[attributeName] = key;
          expressionAttributeValues[attributeValue] = value;
        });

        // If no fields to update
        if (Object.keys(expressionAttributeValues).length === 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'No fields to update' })
          };
        }

        try {
          // Save the data first
          await docClient.send(new UpdateCommand({
            TableName: tableName,
            Key: {
              UserId: userId
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
          }));

          // If this was a token save, set up Gmail watch and push subscription
          if (isTokenSave) {
            try {              
              // Then register Gmail watch
              const watchData = await registerGmailWatch(body.access_token, userId);
              
              // Save the historyId from the watch response
              if (watchData.historyId) {
                await docClient.send(new UpdateCommand({
                  TableName: tableName,
                  Key: {
                    UserId: userId
                  },
                  UpdateExpression: 'SET #historyId = :historyId, #expiration = :expiration',
                  ExpressionAttributeNames: {
                    '#historyId': 'historyId',
                    '#expiration': 'watchExpiration'
                  },
                  ExpressionAttributeValues: {
                    ':historyId': watchData.historyId,
                    ':expiration': watchData.expiration
                  }
                }));
              }
            } catch (error) {
              console.error('Error setting up Gmail watch and push subscription:', error);
              // We don't want to fail the entire operation if setup fails
              // but we should log it
            }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Data updated successfully' })
          };
        } catch (error) {
          console.error('Error updating DynamoDB:', error);
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Failed to update data' })
          };
        }
      }

      case 'GET': {
        // Get specific data based on query parameters
        const path = 'rawPath' in event ? event.rawPath : event.path;
        const dataType = path?.split('/').pop(); // Get the last part of the path

        const response = await docClient.send(new GetCommand({
          TableName: tableName,
          Key: {
            UserId: userId
          }
        }));

        if (!response.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'No data found' })
          };
        }

        // If specific data type is requested (e.g., code_verifier, tokens)
        if (dataType && dataType !== 'user-data') {
          const requestedData = response.Item[dataType];
          if (requestedData === undefined) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ message: `${dataType} not found` })
            };
          }
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ [dataType]: requestedData })
          };
        }

        // Return all user data
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(response.Item)
        };
      }

      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};