import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../utils/logger';
import { updateUserData, getUserData, updateGmailWatchData } from '../services/dynamodb';
import { registerGmailWatch } from '../services/gmail';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Id-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,DELETE'
};

interface TokenSaveBody {
  access_token: string;
  refresh_token: string;
  [key: string]: any;
}

export async function handlePostRequest(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, userId: string, email: string): Promise<APIGatewayProxyResult> {
  let body: TokenSaveBody;
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
  const isTokenSave = typeof body.access_token === 'string' && typeof body.refresh_token === 'string';

  try {
    await updateUserData(userId, body);

    if (isTokenSave) {
      logger.info('Processing token save operation', { userId, email });
      try {              
        const watchData = await registerGmailWatch(body.access_token as string, email);
        
        if (watchData.historyId && watchData.expiration) {
          await updateGmailWatchData(userId, watchData.historyId, watchData.expiration);
        }
      } catch (error) {
        logger.error('Failed to setup Gmail watch', error, { userId, email });
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

export async function handleGetRequest(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, userId: string): Promise<APIGatewayProxyResult> {
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
    const userData = await getUserData(userId);

    if (!userData) {
      logger.debug('No data found for user', { 
        userId,
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
      availableFields: Object.keys(userData),
      hasRequestedData: dataType ? userData[dataType] !== undefined : true
    });

    // If specific data type is requested (via path or query parameter)
    if (dataType) {
      const requestedData = userData[dataType];
      if (requestedData === undefined) {
        logger.debug('Requested data type not found', {
          userId,
          dataType,
          availableFields: Object.keys(userData)
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
      availableFields: Object.keys(userData),
      totalFields: Object.keys(userData).length
    });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(userData)
    };
  } catch (error) {
    logger.error('Failed to retrieve data from DynamoDB', error, { 
      userId,
      dataType,
      errorName: error instanceof Error ? error.name : 'Unknown Error',
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 