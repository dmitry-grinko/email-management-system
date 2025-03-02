import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgIf } from '@angular/common';
import { WebSocketService, WebSocketMessage } from '../services/websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    NgbNavModule,
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  selectedContent: string = 'manual-input';  // Default selected content
  private wsSubscription?: Subscription;

  constructor(
    private modalService: NgbModal,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    console.log('[DashboardComponent] Initializing...');
    
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
