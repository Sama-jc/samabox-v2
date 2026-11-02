/**
 * SPA Hash Router
 * Native Vanilla ES Modules routing without bundlers.
 */

export const VALID_ROUTES = ['summary', 'calendar', 'tasks', 'news'];
export const DEFAULT_ROUTE = 'summary';

/**
 * Resolves a hash string to a validated route name.
 */
export function resolveRoute(hash = '', validRoutes = VALID_ROUTES, defaultRoute = DEFAULT_ROUTE) {
  if (typeof hash !== 'string') return defaultRoute;
  const clean = hash.replace(/^#\/?/, '').replace(/^\//, '').split('?')[0].trim().toLowerCase();
  if (validRoutes.includes(clean)) {
    return clean;
  }
  return defaultRoute;
}

export class Router {
  constructor({
    routes = {},
    defaultRoute = DEFAULT_ROUTE,
    onRouteChange = null,
    navSelector = '.nav-link'
  } = {}) {
    this.routes = routes;
    this.defaultRoute = defaultRoute;
    this.onRouteChange = onRouteChange;
    this.navSelector = navSelector;
    this.currentRoute = null;
    this._handleHashChange = this._handleHashChange.bind(this);
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  navigate(routeName) {
    const route = resolveRoute(routeName, Object.keys(this.routes), this.defaultRoute);
    window.location.hash = `#/${route}`;
  }

  _updateActiveNav(activeRoute) {
    if (typeof document === 'undefined') return;
    const navLinks = document.querySelectorAll(this.navSelector);
    navLinks.forEach((link) => {
      const linkRoute = link.getAttribute('data-route') || link.getAttribute('href')?.replace(/^#\/?/, '');
      if (linkRoute === activeRoute) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  _handleHashChange() {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const route = resolveRoute(hash, Object.keys(this.routes), this.defaultRoute);
    this.currentRoute = route;

    this._updateActiveNav(route);

    if (typeof this.routes[route] === 'function') {
      this.routes[route]();
    }

    if (typeof this.onRouteChange === 'function') {
      this.onRouteChange(route);
    }
  }

  start() {
    if (typeof window === 'undefined') return;
    window.addEventListener('hashchange', this._handleHashChange);
    window.addEventListener('load', this._handleHashChange);
    this._handleHashChange();
  }

  stop() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('hashchange', this._handleHashChange);
    window.removeEventListener('load', this._handleHashChange);
  }
}
