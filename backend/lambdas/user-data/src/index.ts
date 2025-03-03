import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { jwtDecode } from 'jwt-decode';
import { gmail_v1, auth } from '@googleapis/gmail';

// Logger utility for consistent logging
const logger = {
  info: (message: string, context: Record<string, any> = {}) => {
    console.log(JSON.stringify({ level: 'INFO', message, ...context, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error: any, context: Record<string, any> = {}) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      ...context,
      timestamp: new Date().toISOString()
    }));
  },
  debug: (message: string, context: Record<string, any> = {}) => {
    console.debug(JSON.stringify({ level: 'DEBUG', message, ...context, timestamp: new Date().toISOString() }));
  }
};

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
  logger.info('Starting Gmail watch registration', { userId });
  
  const oauth2Client = new auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const gmail = new gmail_v1.Gmail({ auth: oauth2Client });
  
  try {
    const response = await gmail.users.watch({
      userId,
      requestBody: {
        labelIds: ['INBOX'],
        topicName: `email-management-system-topic`
      }
    });
    
    logger.info('Successfully registered Gmail watch', { 
      userId,
      historyId: response.data.historyId,
      expiration: response.data.expiration 
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to register Gmail watch', error, { userId });
    throw error;
  }
}

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult> => {
  logger.info('Lambda invocation started', { 
    eventType: 'httpMethod' in event ? 'APIGatewayProxyEvent' : 'APIGatewayProxyEventV2',
    method: 'httpMethod' in event ? event.httpMethod : event.requestContext.http.method,
    path: 'path' in event ? event.path : event.rawPath
  });

  // Handle OPTIONS requests for CORS
  if ('httpMethod' in event && event.httpMethod === 'OPTIONS') {
    logger.debug('Handling OPTIONS request');
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
    
    if (!idToken || !accessToken) {
      logger.error('Missing required tokens', null, {
        hasIdToken: !!idToken,
        hasAccessToken: !!accessToken
      });
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized. Missing required tokens.' })
      };
    }
  } catch (error) {
    logger.error('Error parsing headers', error, { headers: event.headers });
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid headers' })
    };
  }

  // Decode and validate both tokens
  try {
    const idTokenPayload = jwtDecode(idToken);
    const accessTokenPayload = jwtDecode(accessToken);

    if (!idTokenPayload || !accessTokenPayload) {
      logger.error('Invalid token payloads', null, {
        hasIdTokenPayload: !!idTokenPayload,
        hasAccessTokenPayload: !!accessTokenPayload
      });
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized. Invalid tokens.' })
      };
    }

    // Verify token claims
    const now = Math.floor(Date.now() / 1000);
    logger.debug('Validating token claims', {
      now,
      idTokenExp: idTokenPayload.exp as number,
      accessTokenExp: accessTokenPayload.exp as number
    });

    if (
      !idTokenPayload.sub ||
      !idTokenPayload.exp ||
      !accessTokenPayload.exp ||
      (idTokenPayload.exp as number) < now ||
      (accessTokenPayload.exp as number) < now
    ) {
      logger.error('Token validation failed', null, {
        hasSub: !!idTokenPayload.sub,
        idTokenExpired: (idTokenPayload.exp as number) < now,
        accessTokenExpired: (accessTokenPayload.exp as number) < now
      });
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
    logger.info('Token validation successful', { userId });

    try {
      const method = 'httpMethod' in event ? event.httpMethod : event.requestContext.http.method;
      
      switch (method) {
        case 'POST': {
          let body;
          try {
            body = JSON.parse('body' in event ? event.body! : event.body || '{}');
            logger.debug('Parsed request body', { bodyKeys: Object.keys(body) });
          } catch (error) {
            logger.error('Failed to parse request body', error);
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
            logger.info('Updating DynamoDB', { 
              userId,
              updateFields: Object.keys(expressionAttributeValues)
            });
            
            await docClient.send(new UpdateCommand({
              TableName: tableName,
              Key: { UserId: userId },
              UpdateExpression: updateExpression,
              ExpressionAttributeNames: expressionAttributeNames,
              ExpressionAttributeValues: expressionAttributeValues
            }));

            if (isTokenSave) {
              logger.info('Processing token save operation', { userId });
              try {              
                const watchData = await registerGmailWatch(body.access_token, userId);
                
                if (watchData.historyId) {
                  logger.info('Saving Gmail watch data', { 
                    userId,
                    historyId: watchData.historyId
                  });
                  
                  await docClient.send(new UpdateCommand({
                    TableName: tableName,
                    Key: { UserId: userId },
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
                logger.error('Failed to setup Gmail watch', error, { userId });
              }
            }

            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({ message: 'Data updated successfully' })
            };
          } catch (error) {
            logger.error('Failed to update DynamoDB', error, { userId });
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({ message: 'Failed to update data' })
            };
          }
        }

        case 'GET': {
          const path = 'rawPath' in event ? event.rawPath : event.path;
          const pathDataType = path?.split('/').pop();
          
          // Get data type from either path parameter or query parameter
          const queryParams = 'queryStringParameters' in event ? event.queryStringParameters : null;
          const queryDataType = queryParams?.type;
          
          // Use path parameter first, then fall back to query parameter
          const dataType = (pathDataType !== 'user-data' ? pathDataType : null) || queryDataType;
          
          logger.info('Processing GET request', { 
            userId,
            path,
            pathDataType,
            queryParams,
            queryDataType,
            finalDataType: dataType,
            requestHeaders: event.headers
          });

          try {
            logger.debug('Fetching data from DynamoDB', {
              userId,
              tableName,
              dataType
            });

            const response = await docClient.send(new GetCommand({
              TableName: tableName,
              Key: { UserId: userId }
            }));

            if (!response.Item) {
              logger.debug('No data found for user', { 
                userId,
                tableName,
                dataType 
              });
              return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'No data found' })
              };
            }

            logger.debug('Successfully retrieved user data', { 
              userId,
              dataType,
              availableFields: Object.keys(response.Item),
              hasRequestedData: dataType ? response.Item[dataType] !== undefined : true
            });

            // If specific data type is requested (via path or query parameter)
            if (dataType) {
              const requestedData = response.Item[dataType];
              if (requestedData === undefined) {
                logger.debug('Requested data type not found', {
                  userId,
                  dataType,
                  availableFields: Object.keys(response.Item)
                });
                return {
                  statusCode: 404,
                  headers: corsHeaders,
                  body: JSON.stringify({ message: `${dataType} not found` })
                };
              }
              logger.info('Successfully retrieved specific data type', {
                userId,
                dataType,
                dataLength: typeof requestedData === 'string' ? requestedData.length : JSON.stringify(requestedData).length
              });
              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ [dataType]: requestedData })
              };
            }

            // Return all user data
            logger.info('Successfully retrieved all user data', {
              userId,
              availableFields: Object.keys(response.Item),
              totalFields: Object.keys(response.Item).length
            });
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify(response.Item)
            };
          } catch (error) {
            logger.error('Failed to retrieve data from DynamoDB', error, { 
              userId,
              dataType,
              tableName,
              errorName: error instanceof Error ? error.name : 'Unknown Error',
              errorMessage: error instanceof Error ? error.message : String(error)
            });
            throw error;
          }
        }

        default:
          logger.error('Method not allowed', null, { method });
          return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Method not allowed' })
          };
      }
    } catch (error) {
      logger.error('Unhandled error in request processing', error, { userId });
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Internal server error' })
      };
    }
  } catch (error) {
    logger.error('Token decode/validation error', error);
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unauthorized. Invalid tokens.' })
    };
  }
};