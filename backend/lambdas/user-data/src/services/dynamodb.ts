import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../utils/logger';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = process.env.USER_DATA_TABLE!;

export async function updateUserData(userId: string, data: Record<string, any>) {
  logger.info('Updating DynamoDB', { 
    userId,
    updateFields: Object.keys(data)
  });
  
  const updateExpression = 'SET ' + Object.entries(data)
    .map((key, index) => {
      console.log('updateExpression: key of updateExpression', key);
      return `#attr${index} = :val${index}`
    })
    .join(', ');
    
  const expressionAttributeNames = Object.entries(data)
    .reduce((acc, [key, index]) => {
      console.log('expressionAttributeNames: key of expressionAttributeNames', key);
      console.log('expressionAttributeNames: Object.keys(data)[index]', Object.keys(data)[index])

      return { ...acc, [`#attr${index}`]: Object.keys(data)[index] }
    }, {});
    
  const expressionAttributeValues = Object.entries(data)
    .reduce((acc, [key, index]) => {
      console.log('expressionAttributeValues: key of expressionAttributeValues', key);
      console.log('expressionAttributeValues: Object.values(data)[index]', Object.values(data)[index])

      return { ...acc, [`:val${index}`]: Object.values(data)[index] }
    }, {});

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