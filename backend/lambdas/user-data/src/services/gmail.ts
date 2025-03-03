import { gmail_v1, auth } from '@googleapis/gmail';
import { logger } from '../utils/logger';

export async function registerGmailWatch(accessToken: string, userEmail: string) {
  logger.info('Starting Gmail watch registration', { userId: userEmail });
  
  const oauth2Client = new auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const gmail = new gmail_v1.Gmail({ auth: oauth2Client });
  
  try {
    const response = await gmail.users.watch({
      userId: userEmail,
      requestBody: {
        labelIds: ['INBOX'],
        topicName: `email-management-system-topic`
      }
    });
    
    logger.info('Successfully registered Gmail watch', { 
      userId: userEmail,
      historyId: response.data.historyId,
      expiration: response.data.expiration 
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to register Gmail watch', error, { userId: userEmail });
    throw error;
  }
} 