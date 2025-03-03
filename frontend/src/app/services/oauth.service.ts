import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

console.log('environment', environment); // TODO: Remove this

@Injectable({
  providedIn: 'root'
})
export class OAuthService {
  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly REDIRECT_URI = 'https://email-management-system.dmitrygrinko.com/dashboard';
  private readonly CODE_VERIFIER_LENGTH = 128;

  constructor(private http: HttpClient) {}

  /**
   * Generates a random code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(this.CODE_VERIFIER_LENGTH);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(x => String.fromCharCode(x % 26 + 97))
      .join('');
  }

  /**
   * Stores the code verifier in the backend
   */
  private async storeCodeVerifier(codeVerifier: string): Promise<void> {
    await this.http.post(`${environment.apiUrl}/user-data`, {
      code_verifier: codeVerifier
    }, { withCredentials: true }).toPromise();
  }

  /**
   * Creates a code challenge from the code verifier using SHA-256
   */
  private async createCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Initiates the OAuth flow by generating and storing the code verifier,
   * creating the code challenge, and redirecting to the authorization endpoint
   */
  public async initiateOAuthFlow(): Promise<void> {
    const codeVerifier = this.generateCodeVerifier();
    await this.storeCodeVerifier(codeVerifier);
    const codeChallenge = await this.createCodeChallenge(codeVerifier);

    const data = {
      client_id: environment.googleClientId,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      scope: 'email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.readonly',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    }

    const params = new URLSearchParams(data);

    window.location.href = `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchanges the authorization code for tokens
   */
  public async getTokens(code: string): Promise<void> {
    try {
      console.log('getTokens code:', code);
      const codeVerifier = await this.getStoredCodeVerifier();
      console.log('getTokens codeVerifier:', codeVerifier);

      const formData = new URLSearchParams();
      formData.append('client_id', environment.googleClientId);
      formData.append('code', code);
      formData.append('redirect_uri', this.REDIRECT_URI);
      formData.append('code_verifier', codeVerifier);
      formData.append('grant_type', 'authorization_code');

      const response = await this.http.post<{
        access_token: string;
        refresh_token: string;
        id_token: string;
        expires_in: number;
      }>(this.GOOGLE_TOKEN_URL, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).toPromise();

      console.log('getTokens response:', response);

      if (response) {
        await this.saveTokens(response);
      }
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  /**
   * Gets the stored code verifier
   */
  private async getStoredCodeVerifier(): Promise<string> {
    const response = await this.http.get<{ code_verifier: string }>(
      `${environment.apiUrl}/user-data/code_verifier`,
      { withCredentials: true }
    ).toPromise();
    return response?.code_verifier || '';
  }

  /**
   * Saves the tokens in the backend
   */
  private async saveTokens(tokens: {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  }): Promise<void> {
    const response = await this.http.post(`${environment.apiUrl}/user-data`, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    }, { withCredentials: true }).toPromise();
    console.log('saveTokens response:', response);
  }
}
