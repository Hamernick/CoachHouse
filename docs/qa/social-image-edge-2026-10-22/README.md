# Social sharing Edge production verification

Node22.13.0 / Next16.2.6 / Turbopack, base443a6576 plus repair. Complete `pnpm exec next build` exits0: compilation60s, TypeScript2.2min,198/198static pages generated. The three image-related Edge warnings from the supplied deployment logs are absent. One inherited next.config.ts/presenter-audio NFT tracing warning remains; no source change made to that route.

All files listed for the three Edge page functions in the final `.next/server/middleware-manifest.json` were read and checked for the rejected `node:fs/promises` and `node:path` imports: accelerator49files, home43files, legacy-home46files; zero matches. Results are in `edge-audit.json`.

A temporary production server at localhost3143 served `/opengraph-image.png` as HTTP200image/png,1200x630,47,775bytes, identicalSHA256to the prior image. `/status` rendered the canonical image URL; home/legacy-home returned200 and accelerator retained its307workspace redirect. `http-verification.json` records results. Server stopped after verification; existing listeners untouched. These are local production artifacts, not a Vercel deployment or production acceptance claim.

Reproduce after `pnpm exec next build` by running the following Node script from the repository root. It uses only installed Next and Node built-ins;3143must be free.

```js
const fs = require('node:fs');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const evidence = '/tmp/coach-house-social-edge-20261022';
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('.next/server/middleware-manifest.json','utf8'));
 const rows=[];
 for(const [entry, value] of Object.entries(manifest.functions)){
  const unsupported=[];
  for(const file of value.files){
   const content=fs.readFileSync('.next/'+file,'utf8');
   for(const pattern of ['node:fs/promises','node:path'])if(content.includes(pattern))unsupported.push({file,pattern});
  }
  rows.push({entry,files:value.files.length,unsupported});
 }
 assert.equal(rows.length,3);
 assert.ok(rows.every(row=>row.unsupported.length===0));
 fs.writeFileSync(evidence+'/edge-audit.json',JSON.stringify(rows,null,2));
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3143'],{stdio:['ignore','pipe','pipe']});
 let output='';let ready;
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Server readiness timeout')),20000);
   child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exit '+code))});
   const receive=data=>{output+=data.toString();if(output.includes('Ready in')){clearTimeout(timer);resolve()}};
   child.stdout.on('data',receive);child.stderr.on('data',receive);
  });
  const response=await fetch('http://localhost:3143/opengraph-image.png');
  const bytes=Buffer.from(await response.arrayBuffer());
  const original=fs.readFileSync('src/app/opengraph-image.png');
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.ok(bytes.equals(original));
  assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
  const status=await fetch('http://localhost:3143/status');const html=await status.text();assert.equal(status.status,200);
  const canonical='https://coachhouse.app/opengraph-image.png';
  for(const name of ['og:image','twitter:image'])assert.ok(html.includes('content="'+canonical+'"')&&html.includes(name));
  assert.ok(!html.includes('content="https://coachhouse.app/opengraph-image"'));
  const routes=[];
  for(const path of ['/home','/legacy-home','/accelerator']){
   const r=await fetch('http://localhost:3143'+path,{redirect:'manual'});
   routes.push({path,status:r.status,location:r.headers.get('location')});assert.ok(r.status<500);
  }
  const result={imageStatus:response.status,imageType:response.headers.get('content-type'),dimensions:[1200,630],bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),statusPage:status.status,canonicalImage:canonical,edgeRoutes:routes};
  fs.writeFileSync(evidence+'/http-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({edgeBundles:rows,http:result},null,2));
 }finally{child.kill('SIGTERM');fs.writeFileSync(evidence+'/production-server.log',output)}
})().catch(error=>{console.error(error);process.exitCode=1});

```
