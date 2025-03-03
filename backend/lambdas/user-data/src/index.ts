import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from './utils/logger';
import { validateTokens } from './services/auth';
import { handlePostRequest, handleGetRequest, corsHeaders } from './handlers/requestHandlers';

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

  const tokenValidation = validateTokens(idToken, accessToken);
  if (!tokenValidation.isValid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: `Unauthorized. ${tokenValidation.error}` })
    };
  }

  try {
    const method = 'httpMethod' in event ? event.httpMethod : event.requestContext.http.method;
    
    switch (method) {
      case 'POST':
        return await handlePostRequest(event, tokenValidation.userId, tokenValidation.email);
      case 'GET':
        return await handleGetRequest(event, tokenValidation.userId);
      default:
        logger.error('Method not allowed', null, { method });
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Method not allowed' })
        };
    }
  } catch (error) {
    logger.error('Unhandled error in request processing', error, { userId: tokenValidation.userId });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};