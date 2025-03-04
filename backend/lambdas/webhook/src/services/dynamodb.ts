import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logError, logInfo } from '../utils/logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'email-management-system';

export interface UserHistory {
  UserId: string;
  historyId: string;
  accessToken: string;
  updatedAt: string;
}

export async function getUserData(userId: string): Promise<UserHistory | null> {
  try {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        UserId: userId,
        type: 'history'
      }
    });

    const response = await docClient.send(command);
    if (!response.Item) {
      return null;
    }

    return {
      UserId: response.Item.UserId,
      historyId: response.Item.historyId,
      accessToken: response.Item.accessToken,
      updatedAt: response.Item.updatedAt
    };
  } catch (error) {
    logError('Error getting user data from DynamoDB', error, { userId });
    throw error;
  }
}

export async function updateUserData(userId: string, historyId: string, accessToken: string): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        UserId: userId,
        type: 'history',
        historyId,
        accessToken,
        updatedAt: new Date().toISOString()
      }
    });

    await docClient.send(command);
    logInfo('Successfully updated user data', { userId, historyId });
  } catch (error) {
    logError('Error updating user data in DynamoDB', error, { userId, historyId });
    throw error;
  }
} 