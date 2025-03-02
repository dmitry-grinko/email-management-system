import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OAuthService } from '../../services/oauth.service';

@Component({
  selector: 'app-oauth-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      class="btn btn-primary" 
      (click)="startOAuth()"
      [disabled]="isLoading">
      {{ isLoading ? 'Connecting...' : 'Connect Gmail Account' }}
    </button>
  `,
  styles: [`
    .btn {
      min-width: 180px;
    }
  `]
})
export class OAuthButtonComponent {
  isLoading = false;

  constructor(private oauthService: OAuthService) {}

  async startOAuth(): Promise<void> {
    try {
      this.isLoading = true;
      await this.oauthService.initiateOAuthFlow();
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      this.isLoading = false;
    }
  }
} 