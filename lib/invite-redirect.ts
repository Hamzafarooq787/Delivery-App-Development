// Run before the auth client can consume an implicit invitation. This also
// rescues providers that fall back to the configured Site URL. Tokens stay
// in the same-origin fragment and are cleared after the provider verifies them.
export const INVITE_REDIRECT_BOOTSTRAP = `(function(){try{var p=new URLSearchParams(location.hash.slice(1));if(location.pathname!=='/auth/invite'&&p.get('type')==='invite'&&p.has('access_token')&&p.has('refresh_token')){var u=new URL('/auth/invite',location.origin);u.hash=location.hash;location.replace(u.href)}}catch(e){}})();`
