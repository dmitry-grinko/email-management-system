import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../utils/logger';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = process.env.USER_DATA_TABLE!;

export async function updateUserData(userId: string, data: Record<string, any>) {
  logger.info('Updating DynamoDB', { 
    userId,
    updateFields: Object.keys(data),
    totalFields: Object.keys(data).length
  });
  
  const entries = Object.entries(data);
  logger.debug('Processing entries', { 
    numberOfEntries: entries.length,
    entries: entries.map(([key]) => key)
  });

  const updateExpression = 'SET ' + entries
    .map((entry, index) => {
      console.log('updateExpression: key of updateExpression', entry);
      return `#attr${index} = :val${index}`
    })
    .join(', ');
    
  const expressionAttributeNames = entries
    .reduce((acc, [key], index) => {
      console.log('expressionAttributeNames: key of expressionAttributeNames', key);
      console.log('expressionAttributeNames: key value', key);

      return { ...acc, [`#attr${index}`]: key }
    }, {});
    
  const expressionAttributeValues = entries
    .reduce((acc, [key, value], index) => {
      console.log('expressionAttributeValues: key of expressionAttributeValues', key);
      console.log('expressionAttributeValues: value', value);

      return { ...acc, [`:val${index}`]: value }
    }, {});

  logger.debug('DynamoDB update parameters', {
    updateExpression,
    expressionAttributeNames,
    expressionAttributeValues
  });

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { UserId: userId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }));
}

export async function getUserData(userId: string) {
  logger.debug('Fetching data from DynamoDB', {
    userId,
    tableName
  });

  const response = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: { UserId: userId }
  }));

  return response.Item;
}

export async function updateGmailWatchData(userId: string, historyId: string, expiration: string) {
  logger.info('Saving Gmail watch data', { 
    userId,
    historyId
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
      ':historyId': historyId,
      ':expiration': expiration
    }
  }));
} 