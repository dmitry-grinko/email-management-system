import { jwtDecode, JwtPayload } from 'jwt-decode';
import { logger } from '../utils/logger';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

interface CognitoIdTokenPayload extends JwtPayload {
  email: string;
}

export interface TokenValidationResult {
  userId: string;
  email: string;
  isValid: boolean;
  error?: string;
}

export function validateTokens(idToken: string, accessToken: string): TokenValidationResult {
  try {
    const idTokenPayload = jwtDecode<CognitoIdTokenPayload>(idToken);
    const accessTokenPayload = jwtDecode(accessToken);

    if (!idTokenPayload || !accessTokenPayload) {
      logger.error('Invalid token payloads', null, {
        hasIdTokenPayload: !!idTokenPayload,
        hasAccessTokenPayload: !!accessTokenPayload
      });
      return { userId: '', email: '', isValid: false, error: 'Invalid tokens' };
    }

    // Verify token claims
    const now = Math.floor(Date.now() / 1000);
    logger.debug('Validating token claims', {
      now,
      idTokenExp: idTokenPayload.exp as number,
      accessTokenExp: accessTokenPayload.exp as number
    });

    if (
      !idTokenPayload.sub ||
      !idTokenPayload.email ||
      !idTokenPayload.exp ||
      !accessTokenPayload.exp ||
      (idTokenPayload.exp as number) < now ||
      (accessTokenPayload.exp as number) < now
    ) {
      logger.error('Token validation failed', null, {
        hasSub: !!idTokenPayload.sub,
        hasEmail: !!idTokenPayload.email,
        idTokenExpired: (idTokenPayload.exp as number) < now,
        accessTokenExpired: (accessTokenPayload.exp as number) < now
      });
      return { userId: '', email: '', isValid: false, error: 'Tokens expired or invalid' };
    }

    // Verify tokens are from your Cognito user pool
    if (
      idTokenPayload.iss !== `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}` ||
      accessTokenPayload.iss !== `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}`
    ) {
      return { userId: '', email: '', isValid: false, error: 'Invalid token issuer' };
    }

    const userId = idTokenPayload.sub;
    const email = idTokenPayload.email;
    logger.info('Token validation successful', { userId, email });
    
    return { userId, email, isValid: true };
  } catch (error) {
    logger.error('Token decode/validation error', error);
    return { userId: '', email: '', isValid: false, error: 'Invalid tokens' };
  }
} 