// Offline-only instrumentation checks. No audio/provider/production connection is made.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';
const dbUrl = new URL(process.env.DATABASE_URL || '');
assert.equal(dbUrl.hostname,'127.0.0.1'); assert.equal(dbUrl.pathname,'/relish_local');
const vite = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
const original = { fetch: globalThis.fetch, log: console.log, error: console.error, key: process.env.OPENAI_API_KEY, debug:process.env.RELISH_TRANSCRIPTION_DEBUG };
const records=[];
let fetches=0;
const cid=randomUUID();
const secret='DO_NOT_LOG_private_content_email@example.test_+61412345678_api_key';
const capture=(...args)=>{for(const v of args)if(typeof v==='string'){try{const parsed=JSON.parse(v);if(parsed.component==='relish.transcription')records.push(parsed);}catch{assert.ok(!v.includes(secret),'private error leaked');}}};
console.log=capture;console.error=capture;
let responseText='You';let status=200;let throws=false;let readThrows=false;
try {
  process.env.RELISH_TRANSCRIPTION_DEBUG='YES';process.env.OPENAI_API_KEY=secret;
  const {transcribeAudio}=await vite.ssrLoadModule('/src/lib/ai.ts');
  const logger=await vite.ssrLoadModule('/src/lib/server/transcriptionDiagnostics.ts');
  const metadata=await vite.ssrLoadModule('/src/lib/recording/transcriptionMetadata.ts');
  const {receiveTranscriptionDiagnostics}=await vite.ssrLoadModule('/src/lib/server/transcriptionBrowserDiagnostics.ts');
  globalThis.fetch=async(url,options)=>{
    assert.equal(String(url),'https://api.openai.com/v1/audio/transcriptions');fetches++;
    assert.equal(options.body.get('model'),'whisper-1');assert.equal(options.body.get('response_format'),'text');
    assert.equal(options.body.get('file').type,'audio/mp4');
    if(throws)throw new Error(secret);
    const response = new Response(responseText,{status,headers:{'x-request-id':'req_offline_fixture'}});
    if(readThrows)response.text=async()=>{throw new Error(secret)};
    return response;
  };
  assert.equal(await transcribeAudio(Buffer.from([1,2,3]),'audio/mp4',{correlationId:cid}),'You');
  assert.equal(fetches,1);
  assert.deepEqual(records.map(r=>r.stage),['provider.prepare','provider.request_attempted','provider.response','provider.result']);
  assert.ok(records.every(r=>r.correlationId===cid));assert.equal(records.at(-1).characterCount,3);assert.equal(records.at(-1).requestId,'req_offline_fixture');
  assert.equal(records.at(-1).emptyContent,false);
  assert.ok(!JSON.stringify(records).includes('You'));
  delete process.env.OPENAI_API_KEY;records.length=0;
  await assert.rejects(transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid}),/credentials/);
  assert.equal(fetches,1);assert.equal(records.at(-1).externalCallAttempted,false);assert.equal(records.at(-1).credentialsConfigured,false);assert.equal(records.at(-1).errorCategory,'missing_credentials');
  process.env.OPENAI_API_KEY=secret;status=401;responseText=secret;records.length=0;
  await assert.rejects(transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid}),e=>!e.message.includes(secret));
  assert.equal(records.at(-1).errorCategory,'provider_auth');assert.equal(records.at(-1).httpStatus,401);
  throws=true;records.length=0;
  await assert.rejects(transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid}));
  assert.equal(records.at(-1).errorCategory,'network');assert.equal(records.at(-1).externalCallAttempted,true);
  throws=false;status=200;readThrows=true;records.length=0;
  await assert.rejects(transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid}));
  assert.equal(records.at(-1).errorCategory,'response_read');
  readThrows=false;responseText='   ';records.length=0;
  assert.equal(await transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid}),'');assert.equal(records.at(-1).emptyContent,true);assert.equal(records.at(-1).characterCount,0);
  process.env.RELISH_TRANSCRIPTION_DEBUG='NO';records.length=0;
  await transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid});assert.equal(records.length,0);
  throws=true;await assert.rejects(transcribeAudio(Buffer.from([1]),'audio/mp4',{correlationId:cid}));assert.equal(records.length,1);assert.equal(records[0].stage,'provider.error');throws=false;
  process.env.RELISH_TRANSCRIPTION_DEBUG='YES';records.length=0;
  const locals={user:{id:randomUUID()},contextSpaceId:randomUUID()};
  const telemetry=(body,owner=locals)=>receiveTranscriptionDiagnostics({locals:owner,request:new Request('http://localhost/api/transcription-diagnostics',{method:'POST',body:JSON.stringify(body)})});
  const payload={stage:'browser.ui_applied',correlationId:cid,characterCount:3,transcript:secret,apiKey:secret,requestId:secret,mimeType:'audio/webm;codecs='+secret,credentialsConfigured:true};
  assert.equal((await telemetry(payload)).status,204);assert.equal(records.length,1);assert.equal(records[0].characterCount,3);assert.equal(records[0].credentialsConfigured,undefined);assert.equal(records[0].mimeType,undefined);
  assert.equal((await telemetry(payload,{})).status,401);
  assert.equal((await telemetry({...payload,stage:secret})).status,400);
  assert.equal((await telemetry({...payload,correlationId:secret})).status,400);
  assert.equal((await telemetry({...payload,transcript:'x'.repeat(5000)})).status,413);
  assert.deepEqual(metadata.safeTranscriptionMetadata({mimeType:secret,errorCategory:secret,durationMs:-1,transcript:secret}),{});
  // Full shared assembly -> real helper (mock fetch) -> poll, retaining exact text.
  const {POST:upload}=await vite.ssrLoadModule('/src/routes/api/upload-chunk/+server.ts');
  const {GET:poll}=await vite.ssrLoadModule('/src/routes/api/transcribe-result/+server.ts');
  const key=randomUUID();records.length=0;responseText='You';
  const event=(index,last)=>{const url=new URL(`http://localhost/api/upload-chunk?key=${key}&mime=audio/mp4&index=${index}&last=${last}`);return{locals,url,request:new Request(url,{method:'POST',body:index===0?new Uint8Array([1,2,3]):new Uint8Array()})};};
  assert.equal((await upload(event(0,0))).status,200);
  const result=await upload(event(1,1));assert.equal(result.status,202);const job=await result.json();assert.equal(job.correlationId,key);
  for(let i=0;i<100;i++){
    const r=await poll({locals,url:new URL('http://localhost/api/transcribe-result?jobId='+job.jobId)});const b=await r.json();
    if(b.status==='done'){assert.equal(b.transcript,'You');assert.equal(b.correlationId,key);break;}
    assert.ok(i<99);await new Promise(r=>setTimeout(r,20));
  }
  for(const stage of ['upload.received','upload.accepted','job.queued','assembly.complete','provider.request_attempted','provider.response','provider.result','job.complete','poll.result']) assert.ok(records.some(r=>r.stage===stage),'missing '+stage);
  assert.ok(records.every(r=>r.correlationId===key));assert.equal(records.find(r=>r.stage==='assembly.complete').audioBytes,3);
  assert.ok(!JSON.stringify(records).includes(secret));assert.ok(!JSON.stringify(records).includes('You'));
  original.log('PASS provider instrumentation, no-fallback behavior, missing credentials/no call, HTTP/network errors, empty result, debug gating, telemetry authentication/redaction/limits, shared upload/assembly/poll correlation');
} finally {
  globalThis.fetch=original.fetch;console.log=original.log;console.error=original.error;
  for(const [name,v] of [['OPENAI_API_KEY',original.key],['RELISH_TRANSCRIPTION_DEBUG',original.debug]])if(v===undefined)delete process.env[name];else process.env[name]=v;
  await vite.close();
}
