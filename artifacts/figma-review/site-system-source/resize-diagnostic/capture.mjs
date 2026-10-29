import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const web = path.join(root, 'apps/web');
const out = path.join(root, 'artifacts/figma-review/site-system-source/resize-diagnostic');
if (fs.existsSync(path.join(out,'manifest.json'))) throw new Error('Manifest already exists; refusing overwrite');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync('/tmp/site-system-resize-diagnostic.mjs', path.join(out, 'capture.mjs'));
const req = createRequire(path.join(web, 'package.json'));
const imp = name => import(pathToFileURL(req.resolve(name)).href);
const sha = data => createHash('sha256').update(data).digest('hex');
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {cwd:root}).toString().split('\0').filter(p=>p&&!p.startsWith('artifacts/'));
const snapshot = () => Object.fromEntries([...new Set(files)].filter(p=>fs.existsSync(path.join(root,p))&&fs.statSync(path.join(root,p)).isFile()).map(p=>[p,{sha256:sha(fs.readFileSync(path.join(root,p))),mtime:fs.statSync(path.join(root,p)).mtime.toISOString()}]));
const before = snapshot();
const manifest = { label: '当前代码渲染，fixture身份/数据；不是实际后端登录联调', root, startedAt:new Date().toISOString(), gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(), command:'node /tmp/site-system-source-capture.mjs (from worktree root)', sourceBefore:before, options:{port:43111,host:'127.0.0.1',strictPort:true,configFile:false,NODE_ENV:'production',mode:'production',VITE_SERVER_URL:'http://127.0.0.1:43111',cacheDir:'/tmp/site-system-source-vite-cache',router:{target:'react',autoCodeSplitting:true,enableRouteGeneration:false},note:'Same plugin families/options as apps/web/vite.config.ts, with route generation disabled to prevent source writes. Vite dev server with production NODE_ENV to omit devtools; not a production build.'},captures:[],requests:[],errors:[],blocked:[]};
fs.writeFileSync(path.join(out,'source-before.json'),JSON.stringify(before,null,2));
process.env.NODE_ENV='production';
process.env.VITE_SERVER_URL='http://127.0.0.1:43111';
process.chdir(web);
let server, browser;
try {
 const {createServer}=await imp('vite');
 const {default:tailwindcss}=await imp('@tailwindcss/vite');
 const {tanstackRouter}=await imp('@tanstack/router-plugin/vite');
 const {varlockVitePlugin}=await imp('@varlock/vite-integration');
 const {default:react}=await imp('@vitejs/plugin-react');
 server=await createServer({root:web,configFile:false,mode:'production',cacheDir:'/tmp/site-system-source-vite-cache',server:{host:'127.0.0.1',port:43111,strictPort:true},resolve:{tsconfigPaths:true},plugins:[varlockVitePlugin({ssrInjectMode:'auto-load'}),tailwindcss(),tanstackRouter({target:'react',autoCodeSplitting:true,enableRouteGeneration:false}),react()]});
 await server.listen();
 console.log('TEMP_VITE_READY 43111',root);
 const {chromium,expect}=req('@playwright/test');
 browser=await chromium.launch({headless:true});
 manifest.browserVersion=browser.version();
 const date=new Date().toISOString();
 const identity={user:{id:'feedback-user',name:'Feedback tester',email:'feedback@example.test',emailVerified:true,createdAt:date,updatedAt:date},session:{id:'feedback-session',userId:'feedback-user',token:'test-only',expiresAt:new Date(Date.now()+3600000).toISOString(),createdAt:date,updatedAt:date}};
 const access={role:'user',organizationId:'application',pages:['todos','dashboard','tasks','apps','chats']};
 const spaces=[{id:'application',name:'Application',slug:'application'}];
 const todos={items:[{id:1,text:'Review the visual system',completed:false},{id:2,text:'Verify shared components',completed:true},{id:3,text:'Check mobile layout',completed:false}],nextCursor:null};
 manifest.fixture={source:'apps/web/tests/feedback.spec.ts mockSession and todo/list fixtures',identity,access,spaces,todos};

 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'dark',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('vite-ui-theme','dark'));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://127.0.0.1:43111')return route.abort();
  if(url.pathname.startsWith('/api/auth/'))return route.fulfill({json:identity});
  if(url.pathname==='/rpc/access/me')return route.fulfill({json:{json:access}});
  if(url.pathname==='/rpc/access/mine')return route.fulfill({json:{json:spaces}});
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/rpc/'))return route.abort();
  return route.continue();
 });
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:43111/apps?workspace=application');
 const card=page.getByRole('button',{name:'Todos',exact:true});
 await expect(card).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{
  const el=document.querySelector('button[aria-label="Search pages"]');
  window.__resizeEvidence={samples:[],events:[],css:{transitionProperty:getComputedStyle(el).transitionProperty,transitionDuration:getComputedStyle(el).transitionDuration,transitionTimingFunction:getComputedStyle(el).transitionTimingFunction}};
  const sample=time=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();window.__resizeEvidence.samples.push({time,viewport:innerWidth,x:r.x,width:r.width,computedWidth:s.width,minWidth:s.minWidth,flex:s.flex,animations:el.getAnimations().map(a=>({property:a.transitionProperty,currentTime:a.currentTime,playState:a.playState}))});if(!window.__stopSampling)requestAnimationFrame(sample);};
  for(const type of ['transitionrun','transitionstart','transitionend'])el.addEventListener(type,e=>window.__resizeEvidence.events.push({type,property:e.propertyName,elapsed:e.elapsedTime,time:performance.now(),viewport:innerWidth}));
  requestAnimationFrame(sample);
 });
 // Reproduce existing workspaces.spec.ts loop: resize -> visible -> fonts.ready -> screenshot.
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  await expect(card).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  const filename=`resize-immediate-${width}x1000-dark.png`;
  await page.screenshot({path:path.join(out,filename),fullPage:true});
  manifest.captures.push({filename,width,kind:'existing-test-resize-sequence'});
 }
 await page.waitForTimeout(250);
 manifest.resizeEvidence=await page.evaluate(()=>{window.__stopSampling=true;return window.__resizeEvidence;});
 await page.screenshot({path:path.join(out,'resize-settled-390x1000-dark.png'),animations:'disabled'});
 console.log('TRANSITION_CSS',JSON.stringify(manifest.resizeEvidence.css));
 console.log('MOBILE_SAMPLES',JSON.stringify(manifest.resizeEvidence.samples.filter(s=>s.viewport===390)));
 await context.close();
} catch(error){manifest.failure=error.stack;console.error(error);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 if(server)await server.close();
 manifest.closedAt=new Date().toISOString();
 manifest.serverClosed=Boolean(server);
 const after=snapshot();
 manifest.sourceChanges=Object.keys(before).filter(p=>before[p].sha256!==after[p]?.sha256||before[p].mtime!==after[p]?.mtime);
 fs.writeFileSync(path.join(out,'source-after.json'),JSON.stringify(after,null,2));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('TEMP_SERVER_CLOSED; SOURCE_CHANGES',JSON.stringify(manifest.sourceChanges));
}
