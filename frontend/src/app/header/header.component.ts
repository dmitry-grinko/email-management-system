import { Component, HostListener, ElementRef } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { RouterModule, Router } from '@angular/router';
import { CommonModule, NgFor } from '@angular/common';
import { NavigationEnd } from '@angular/router';

interface NavItem {
  path?: string;
  label: string;
  action?: (event: Event) => void;
  styleClass: string;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, NgFor]
})
export class HeaderComponent {
  title = 'Email Management System';
  private readonly _authService: AuthService;
  private readonly _router: Router;
  isMenuOpen = false;
  activeItem: string | null = null;

  authenticatedNavItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      styleClass: 'nav-link px-3'
    },
    {
      label: 'Logout',
      action: (event: Event) => this.logout(event),
      styleClass: 'btn btn-outline-primary border-0 rounded ms-2'
    }
  ];

  unauthenticatedNavItems: NavItem[] = [
    {
      path: '/auth/login',
      label: 'Login',
      styleClass: 'btn border-0 rounded me-2'
    },
    {
      path: '/auth/signup',
      label: 'Sign Up',
      styleClass: 'btn border-0 rounded'
    }
  ];

  constructor(
    authService: AuthService,
    router: Router,
    private elementRef: ElementRef
  ) {
    this._authService = authService;
    this._router = router;
    
    // Set initial active state based on current route
    this.setActiveItemFromRoute(this._router.url);
    
    // Subscribe to router events to update active state
    this._router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.setActiveItemFromRoute(event.url);
      }
    });
  }

  get isAuthenticated$() {
    return this._authService.isAuthenticated$;
  }

  logout(event: Event): void {
    event.preventDefault();
    this._authService.logout();
    this._router.navigate(['/']);
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.closeMenu();
    }
  }

  onNavItemClick(event: Event, item: NavItem) {
    if (item.action) {
      item.action(event);
    } else if (item.path) {
      this.setActiveItemFromRoute(item.path);
    }
    this.closeMenu();
  }

  private setActiveItemFromRoute(url: string) {
    const allItems = [...this.authenticatedNavItems, ...this.unauthenticatedNavItems];
    const matchingItem = allItems.find(item => item.path === url);
    this.activeItem = matchingItem?.label || null;
  }

  isActive(item: NavItem): boolean {
    if (item.path) {
      return item.path === this._router.url;
    }
    return this.activeItem === item.label;
  }
}
