// Stage 8.20.3 — Machine-authenticated registration. No user login cookies,
// participant data, or cross-environment fallback. Disabled unless configured.
import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';
import { readDorianDeploymentRegistration, registerDorianDeployment,
  DorianRegistrationConflict } from '$lib/server/integrations/elevenlabs/dorianDeploymentRegistry';

const NO_STORE={'cache-control':'no-store'};
function authorized(header:string|null) {
  const token=process.env.RELISH_DORIAN_DEPLOYMENT_REGISTRATION_TOKEN;
  if (!token || token.length<32 || !header?.startsWith('Bearer ')) return false;
  const a=Buffer.from(header.slice(7)); const b=Buffer.from(token);
  return a.length===b.length && timingSafeEqual(a,b);
}
function gate(header:string|null) {
  if (!process.env.RELISH_DORIAN_DEPLOYMENT_OWNER_USER_ID || !process.env.RELISH_DORIAN_DEPLOYMENT_REGISTRATION_TOKEN)
    return json({error:'REGISTRATION_NOT_CONFIGURED'},{status:503,headers:NO_STORE});
  if (!authorized(header)) return json({error:'UNAUTHORISED'},{status:401,headers:NO_STORE});
  return null;
}
export const GET:RequestHandler=async({request})=>{
  const rejected=gate(request.headers.get('authorization'));
  if(rejected)return rejected;
  try{return json(await readDorianDeploymentRegistration(),{headers:NO_STORE});}
  catch(error){console.error('[dorian-registration] status failed',error instanceof Error?error.name:'UNKNOWN');return json({error:'REGISTRATION_UNAVAILABLE'},{status:503,headers:NO_STORE});}
};
export const POST:RequestHandler=async({request})=>{
  const rejected=gate(request.headers.get('authorization'));
  if(rejected)return rejected;
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))
    return json({error:'JSON_REQUIRED'},{status:415,headers:NO_STORE});
  let body:Record<string,unknown>;
  try{const raw=await request.text();if(raw.length>3000)throw Error('size');const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('shape');body=v;}
  catch{return json({error:'INVALID_REQUEST'},{status:400,headers:NO_STORE});}
  if(body.confirm!=='REGISTER')return json({error:'EXPLICIT_CONFIRMATION_REQUIRED'},{status:400,headers:NO_STORE});
  try{return json(await registerDorianDeployment(body),{headers:NO_STORE});}
  catch(error){
    const conflict=error instanceof DorianRegistrationConflict;
    if(!conflict)console.error('[dorian-registration] registration failed',error instanceof Error?error.name:'UNKNOWN');
    return json({error:conflict?'REGISTRATION_CONFLICT':'REGISTRATION_FAILED',
      detail:conflict?error.message:undefined},{status:conflict?409:400,headers:NO_STORE});
  }
};
