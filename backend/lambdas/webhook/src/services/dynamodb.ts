import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logError, logInfo } from '../utils/logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

if (!TABLE_NAME) {
  logError('DYNAMODB_TABLE_NAME environment variable is not set', {});
  throw new Error('DYNAMODB_TABLE_NAME is not set');
}

logInfo('DynamoDB service initialized', { tableName: TABLE_NAME });

export interface UserData {
  UserId: string;
  historyId: string;
  access_token: string;
  code_verifier: string;
  id_token: string;
  refresh_token: string;
  token_expiry: string;
  watchExpiration: string;
  updatedAt: string;
}

export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    logInfo('Attempting to get user data from DynamoDB', { userId });

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        UserId: userId
      }
    });

    logInfo('DynamoDB GetCommand details', { 
      tableName: TABLE_NAME,
      key: command.input.Key 
    });

    const response = await docClient.send(command);
    
    logInfo('DynamoDB GetCommand response received', { 
      hasItem: !!response.Item,
      item: response.Item 
    });

    if (!response.Item) {
      logInfo('No user data found in DynamoDB', { userId });
      return null;
    }

    const userData = {
      UserId: response.Item.UserId,
      historyId: response.Item.historyId,
      access_token: response.Item.access_token,
      code_verifier: response.Item.code_verifier,
      id_token: response.Item.id_token,
      refresh_token: response.Item.refresh_token,
      token_expiry: response.Item.token_expiry,
      watchExpiration: response.Item.watchExpiration,
      updatedAt: response.Item.updatedAt
    };

    logInfo('Successfully retrieved user data', { 
      userId,
      historyId: userData.historyId,
      hasAccessToken: !!userData.access_token,
      hasRefreshToken: !!userData.refresh_token,
      tokenExpiry: userData.token_expiry,
      updatedAt: userData.updatedAt
    });

    return userData;
  } catch (error: unknown) {
    const errorDetails = error instanceof Error ? {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    } : {
      errorName: 'Unknown',
      errorMessage: String(error),
      errorStack: undefined
    };

    logError('Error getting user data from DynamoDB', error, { 
      userId,
      ...errorDetails
    });
    throw error;
  }
}

export async function updateUserData(
  userId: string, 
  historyId: string, 
  accessToken: string,
  codeVerifier: string,
  idToken: string,
  refreshToken: string,
  tokenExpiry: string,
  watchExpiration: string
): Promise<void> {
  try {
    logInfo('Attempting to update user data in DynamoDB', { 
      userId,
      historyId,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      tokenExpiry
    });

    const updatedAt = new Date().toISOString();
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        UserId: userId,
        historyId,
        access_token: accessToken,
        code_verifier: codeVerifier,
        id_token: idToken,
        refresh_token: refreshToken,
        token_expiry: tokenExpiry,
        watchExpiration,
        updatedAt
      }
    });

    logInfo('DynamoDB PutCommand details', { 
      tableName: TABLE_NAME,
      item: {
        ...command.input.Item,
        access_token: command.input.Item?.access_token ? '[REDACTED]' : undefined,
        refresh_token: command.input.Item?.refresh_token ? '[REDACTED]' : undefined,
        id_token: command.input.Item?.id_token ? '[REDACTED]' : undefined
      }
    });

    await docClient.send(command);
    
    logInfo('Successfully updated user data in DynamoDB', { 
      userId, 
      historyId,
      updatedAt
    });
  } catch (error: unknown) {
    const errorDetails = error instanceof Error ? {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    } : {
      errorName: 'Unknown',
      errorMessage: String(error),
      errorStack: undefined
    };

    logError('Error updating user data in DynamoDB', error, { 
      userId, 
      historyId,
      ...errorDetails
    });
    throw error;
  }
} 