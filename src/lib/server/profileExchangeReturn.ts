// Server-only, account-bound editor return. No submitted redirect URL is trusted.
import type { Cookies } from '@sveltejs/kit';
import { encrypt, decrypt } from '$lib/crypto';
const key='relish_profile_exchange_return';
export function saveProfileExchangeReturn(cookies:Cookies,url:URL,account:string,slug:string){
 cookies.set(key,encrypt(JSON.stringify({account,slug,at:Date.now()}),'profile.exchange.return.v1'),{path:'/',httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',maxAge:1800});
}
export function profileExchangeReturn(cookies:Cookies,account:string){
 try {const v=JSON.parse(decrypt(cookies.get(key)||'','profile.exchange.return.v1'));
 if(v.account!==account || typeof v.slug!=='string' || v.slug.length>200 || !/^[a-zA-Z0-9_-]+$/.test(v.slug) || !Number.isFinite(v.at) || v.at>Date.now() || Date.now()-v.at>=1800000) return null;
 return '/u/'+encodeURIComponent(v.slug)+'/share-details';
 } catch {return null;}
}

// Consume the anonymous navigation hint after sign-in; it conveys no sharing authority.
export function clearProfileExchangeReturn(cookies:Cookies){ cookies.delete(key,{path:'/'}); }
