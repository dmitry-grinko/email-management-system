import { google } from 'googleapis';
import { logError, logInfo } from '../utils/logger';

const gmail = google.gmail('v1');

export interface GmailHistoryResponse {
  historyId: string;
  messages: Array<{
    id: string;
    threadId: string;
  }>;
}

export async function getGmailHistory(
  accessToken: string,
  startHistoryId: string,
  historyId: string
): Promise<GmailHistoryResponse> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const response = await gmail.users.history.list({
      auth,
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded']
    });

    const messages = response.data.history?.flatMap((history: any) => 
      history.messagesAdded?.map((msg: any) => ({
        id: msg.message?.id || '',
        threadId: msg.message?.threadId || ''
      })) || []
    ) || [];

    logInfo('Retrieved Gmail history', {
      startHistoryId,
      historyId,
      messageCount: messages.length
    });

    return {
      historyId: historyId,
      messages
    };
  } catch (error) {
    logError('Error fetching Gmail history', error, { startHistoryId, historyId });
    throw error;
  }
}

export async function getMessageDetails(
  accessToken: string,
  messageId: string
): Promise<any> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const response = await gmail.users.messages.get({
      auth,
      userId: 'me',
      id: messageId
    });

    return response.data;
  } catch (error) {
    logError('Error fetching message details', error, { messageId });
    throw error;
  }
} 