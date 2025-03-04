import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { logError, logInfo } from '../utils/logger';

const client = new CognitoIdentityProviderClient({});

export async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID environment variable is not set');
    }

    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${email}"`
    });

    const response = await client.send(command);
    
    if (!response.Users || response.Users.length === 0) {
      logInfo('No user found for email', { email });
      return null;
    }

    const userId = response.Users[0].Username;
    if (!userId) {
      logError('User found but no Username', null, { email });
      return null;
    }

    logInfo('Found user ID for email', { email, userId });
    return userId;
  } catch (error) {
    logError('Error getting user ID from Cognito', error, { email });
    throw error;
  }
} 