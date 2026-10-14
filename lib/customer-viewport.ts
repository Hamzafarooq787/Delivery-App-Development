export const CUSTOMER_HEIGHT_BREAKPOINTS = [800, 760, 660, 640, 590, 520] as const
export function customerHeightFlags(height: number): string {
  return CUSTOMER_HEIGHT_BREAKPOINTS.filter(limit => height <= limit).map(limit => 'h' + limit).join(' ')
}
// Runs before CSS/content is painted, even when hydration or user data is slow.
export const CUSTOMER_VIEWPORT_BOOTSTRAP = `(function(){if(location.pathname!='/dashboard/customer')return;var d=document.documentElement,v=window.visualViewport,h=Math.floor(Math.min(window.innerHeight,v?v.height:window.innerHeight));if(!isFinite(h)||h<1)return;d.style.setProperty('--customer-viewport-height',h+'px');d.setAttribute('data-customer-height',${JSON.stringify(CUSTOMER_HEIGHT_BREAKPOINTS)}.filter(function(n){return h<=n}).map(function(n){return 'h'+n}).join(' '));})();`
