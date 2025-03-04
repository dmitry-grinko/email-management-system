import { APIGatewayProxyHandler } from 'aws-lambda';
import { logError, logInfo } from './utils/logger';
import { getUserData, updateUserData } from './services/dynamodb';
import { getGmailHistory, getMessageDetails } from './services/gmail';
import { getUserIdByEmail } from './services/cognito';

interface WebhookMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!event.body) {
      throw new Error('No body in request');
    }

    const webhookData: WebhookMessage = JSON.parse(event.body);
    const decodedData = JSON.parse(Buffer.from(webhookData.message.data, 'base64').toString());
    
    const { emailAddress, historyId: newHistoryId } = decodedData;
    
    if (!emailAddress || !newHistoryId) {
      throw new Error('Missing required fields in decoded data');
    }

    // Get UserId from Cognito using email
    const userId = await getUserIdByEmail(emailAddress);
    if (!userId) {
      logInfo('No user found for email, skipping processing', {
        emailAddress,
        newHistoryId
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No user found for email' })
      };
    }

    // Get user data from DynamoDB
    const userData = await getUserData(userId);
    
    if (!userData) {
      logInfo('No user data found, skipping processing', {
        userId,
        emailAddress,
        newHistoryId
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No user data found' })
      };
    }

    // Compare history IDs
    if (parseInt(newHistoryId) <= parseInt(userData.historyId)) {
      logInfo('Skipping processing - new history ID is not greater than stored one', {
        userId,
        emailAddress,
        storedHistoryId: userData.historyId,
        newHistoryId
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No new changes to process' })
      };
    }

    // Fetch changes from Gmail API using stored access token
    const historyResponse = await getGmailHistory(userData.access_token, userData.historyId, newHistoryId);
    
    logInfo('historyResponse', historyResponse);

    // Process new messages
    for (const message of historyResponse.messages) {
      const messageDetails = await getMessageDetails(userData.access_token, message.id);

      logInfo('messageDetails', messageDetails);
      // logInfo('Processing new message', {
      //   messageId: message.id,
      //   threadId: message.threadId,
      //   snippet: messageDetails.snippet
      // });
      // TODO: Implement message processing logic here
    }

    // Update user data with new history ID
    await updateUserData(
      userId,
      newHistoryId,
      userData.access_token,
      userData.code_verifier,
      userData.id_token,
      userData.refresh_token,
      userData.token_expiry,
      userData.watchExpiration
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully processed changes',
        processedMessages: historyResponse.messages.length
      })
    };

  } catch (error) {
    logError('Error processing webhook', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
