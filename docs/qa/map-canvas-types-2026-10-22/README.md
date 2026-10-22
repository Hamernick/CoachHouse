# Canvas repair browser evidence

Captured October 22, 2026, Chromium 1208 on macOS. The harness bundles the actual six production canvas modules before and after the repair; it does not reimplement their drawing code. Native DOM canvas and native OffscreenCanvas each render light/dark, selected/unselected, fallback/remote markers, cooling-center pills, cluster sprites, seven static badges/shadows, and normalized fallback bitmaps.

All 60 comparisons match width, height, and every RGBA byte; every image contains nontransparent pixels. The JSON records each case; the screenshot shows the resulting markers and was visually inspected. This is native-browser renderer verification, not a full Mapbox integration or production acceptance claim. No intentional visual changes or baseline updates.

The private bundles and runnable harness remain in `/tmp/coach-house-map-types-20261022/`; their exact harness source is retained below for reproduction with bundles from the base and repaired revisions. Synthetic bitmap data only; no remote resource data or credentials.

## Browser harness

```python
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path('/tmp/coach-house-map-types-20261022')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/Users/calebhamernick/Library/Caches/ms-playwright/chromium-1208/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
 page=browser.new_page(viewport={'width':1200,'height':900},device_scale_factor=1)
 page.set_content('<html><body><h1>Map marker rendering parity</h1><p>Actual production renderers: DOM and OffscreenCanvas, light/dark, selected/unselected.</p><main id="gallery"></main><style>body{font:14px system-ui;padding:24px;margin:0;background:#f4f4f5}h1{margin:0 0 8px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}section{border:1px solid #bbb;border-radius:8px;padding:12px;min-height:130px}h2{font:600 13px system-ui}canvas{max-width:100%;height:auto;max-height:90px;object-fit:contain}section.dark{background:#171717;color:#eee}</style></body></html>')
 page.add_script_tag(path=str(root/'markers-before.js'));page.evaluate('window.Before=Markers')
 page.add_script_tag(path=str(root/'markers-after.js'));page.evaluate('window.After=Markers')
 result=page.evaluate('''async () => {
 const nativeOffscreen=window.OffscreenCanvas;const outcomes=[];
 const source=document.createElement('canvas');source.width=96;source.height=64;const sourceContext=source.getContext('2d');sourceContext.fillStyle='#2563eb';sourceContext.fillRect(0,0,48,64);sourceContext.fillStyle='#f59e0b';sourceContext.fillRect(48,0,48,64);const bitmap=await createImageBitmap(source);
 function pixels(image){if(image instanceof ImageData)return image; const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height)}
 function compare(name,a,b,theme){if(!a||!b)throw Error(name+':missing image');a=pixels(a);b=pixels(b);if(a.width!==b.width||a.height!==b.height||a.data.length!==b.data.length)throw Error(name+':size mismatch');let visible=0;let hash=2166136261;for(let i=0;i<a.data.length;i++){if(a.data[i]!==b.data[i])throw Error(name+':pixel mismatch '+i);hash=Math.imul(hash^b.data[i],16777619);if(i%4===3&&b.data[i])visible++}if(!visible)throw Error(name+':blank image');outcomes.push({name,width:b.width,height:b.height,identical:true,visiblePixels:visible,hash:hash>>>0});const section=document.createElement('section');section.className=theme;const title=document.createElement('h2');title.textContent=name;section.append(title);const canvas=document.createElement('canvas');canvas.width=b.width;canvas.height=b.height;canvas.getContext('2d').putImageData(b,0,0);canvas.style.width=(b.width>500?204:96)+'px';section.append(canvas);document.getElementById('gallery').append(section)}
 for(const kind of ['dom','offscreen']){
 Object.defineProperty(window,'OffscreenCanvas',{value:kind==='offscreen'?nativeOffscreen:undefined,configurable:true,writable:true});
 for(const theme of ['light','dark'])for(const selected of [false,true]){
 const tag=kind+' | '+theme+' | '+(selected?'selected':'normal');const input={label:'Community resources',primaryGroup:'housing',markerAccentColor:'#2563eb',theme,selected};
 for(const method of ['legacy','pin'])compare(tag+' | '+method,Before[method](input),After[method](input),theme);
 for(const method of ['legacyRemote','pinRemote'])compare(tag+' | '+method,Before[method]({...input,bitmap}),After[method]({...input,bitmap}),theme);
 compare(tag+' | cooling',Before.special({...input,resourceCategory:'emergency_cooling_centers',sameLocationCount:3}),After.special({...input,resourceCategory:'emergency_cooling_centers',sameLocationCount:3}),theme);
 }
 for(const theme of ['light','dark']){
 const signature={signature:'parity',imageId:'parity',markerTheme:theme,tierName:'small',tier:{size:64,avatars:1},totalCount:3,visibleImageKeys:[],visibleCategoryColors:['#2563eb','#e11d48'],visibleCategoryKeys:['housing','food'],overflowCount:0,zoomBucket:8};
 compare(kind+' | '+theme+' | cluster',Before.cluster({signature}).image,After.cluster({signature}).image,theme);
 }
 const oldImages=new Map(),newImages=new Map();Before.badges({hasImage:key=>oldImages.has(key),addImage:(key,image)=>oldImages.set(key,image)});After.badges({hasImage:key=>newImages.has(key),addImage:(key,image)=>newImages.set(key,image)});if(oldImages.size!==newImages.size)throw Error('badge count changed');for(const [key,image]of oldImages)compare(kind+' | '+key,image,newImages.get(key),'light');
 Before.resetCache();After.resetCache();const req={imageKey:'parity',imageUrl:null,fallbackLabel:'Community',primaryGroup:'housing'};const oldBitmap=await Before.bitmap(req),newBitmap=await After.bitmap(req);if(oldBitmap.status!==newBitmap.status)throw Error('bitmap status changed');compare(kind+' | normalized bitmap',oldBitmap.bitmap,newBitmap.bitmap,'light');oldBitmap.bitmap.close();newBitmap.bitmap.close();
 }
 Object.defineProperty(window,'OffscreenCanvas',{value:nativeOffscreen,configurable:true,writable:true});bitmap.close();return outcomes;
}''')
 page.screenshot(path=str(root/'marker-parity.png'),full_page=True)
 (root/'browser-parity.json').write_text(json.dumps(result,indent=2))
 print(json.dumps({'cases':len(result),'identical_pixels':True,'all_nonblank':True,'native_contexts':['HTMLCanvasElement','OffscreenCanvas']}))
 browser.close()

```

## Bundle entry

Create `.tmp/marker-browser-entry.ts` in each revision, then bundle before/after to the paths expected above using the existing Vite esbuild installation.

```ts
export { createPublicMapFallbackMarkerImage as legacy, createPublicMapRemoteMarkerImage as legacyRemote } from '../src/lib/public-map/public-map-marker-canvas'
export { createPublicMapFallbackMarkerImage as pin, createPublicMapRemoteMarkerImage as pinRemote } from '../src/lib/public-map/public-map-pin-marker-canvas'
export { createPublicMapSpecialPillMarkerImage as special } from '../src/lib/public-map/public-map-special-marker-canvas'
export { ensurePublicMapBadgeImages as badges } from '../src/lib/public-map/public-map-marker-static-images'
export { buildPublicMapClusterSprite as cluster } from '../src/lib/public-map/public-map-cluster-sprite-renderer'
export { getPublicMapMarkerImageBitmap as bitmap, resetPublicMapMarkerBitmapCacheForTest as resetCache } from '../src/lib/public-map/public-map-marker-bitmap-cache'

```

```js
const esbuild=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}));
esbuild.buildSync({entryPoints:['.tmp/marker-browser-entry.ts'],bundle:true,platform:'browser',format:'iife',globalName:'Markers',outfile:'/tmp/coach-house-map-types-20261022/'+process.argv[2]+'.js',tsconfig:'tsconfig.json',define:{'process.env.NODE_ENV':'"development"'}});

```
