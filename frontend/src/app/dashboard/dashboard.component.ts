import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgIf, CommonModule } from '@angular/common';
import { WebSocketService, WebSocketMessage } from '../services/websocket.service';
import { Subscription } from 'rxjs';
import { OAuthButtonComponent } from './oauth-button/oauth-button.component';
import { ActivatedRoute } from '@angular/router';
import { OAuthService } from '../services/oauth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    NgbNavModule,
    CommonModule,
    OAuthButtonComponent
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  selectedContent: string = 'manual-input';  // Default selected content
  private wsSubscription?: Subscription;

  constructor(
    private modalService: NgbModal,
    private webSocketService: WebSocketService,
    private route: ActivatedRoute,
    private oauthService: OAuthService
  ) {}

  ngOnInit() {
    // Handle OAuth callback
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      if (code) {
        this.handleOAuthCallback(code);
      }
    });
  }

  private async handleOAuthCallback(code: string) {
    try {
      await this.oauthService.getTokens(code);
      // You might want to show a success message or update the UI here
      console.log('Successfully authenticated with Gmail');
    } catch (error) {
      console.error('Failed to exchange authorization code for tokens:', error);
      // You might want to show an error message to the user here
    }
  }

  setupWebSocket() {
    // Connect to WebSocket when component initializes
    console.log('[DashboardComponent] Attempting to connect to WebSocket');
    this.webSocketService.connect();
    
    // Subscribe to messages
    this.wsSubscription = this.webSocketService.messages$.subscribe(message => {
      console.log('[DashboardComponent] Received WebSocket message:', message);
      // Let the ToastComponent handle the messages through its own subscription
      // Remove the modal handling code
    });

    // Monitor connection status
    this.webSocketService.connectionStatus$.subscribe(isConnected => {
      console.log('[DashboardComponent] WebSocket connection status changed:', isConnected);
    });
  }

  ngOnDestroy() {
    console.log('[DashboardComponent] Component destroying, cleaning up subscriptions');
    this.wsSubscription?.unsubscribe();
  }
}
