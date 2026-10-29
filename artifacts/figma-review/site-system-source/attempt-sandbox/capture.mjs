import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const web = path.join(root, 'apps/web');
const out = path.join(root, 'artifacts/figma-review/site-system-source');
if (fs.existsSync(out)) throw new Error('Evidence directory already exists; refusing overwrite');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync('/tmp/site-system-source-capture.mjs', path.join(out, 'capture.mjs'));
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
 const {chromium,expect}=await imp('@playwright/test');
 browser=await chromium.launch({headless:true});
 manifest.browserVersion=browser.version();
 const date=new Date().toISOString();
 const identity={user:{id:'feedback-user',name:'Feedback tester',email:'feedback@example.test',emailVerified:true,createdAt:date,updatedAt:date},session:{id:'feedback-session',userId:'feedback-user',token:'test-only',expiresAt:new Date(Date.now()+3600000).toISOString(),createdAt:date,updatedAt:date}};
 const access={role:'user',organizationId:'application',pages:['todos','dashboard','tasks','apps','chats']};
 const spaces=[{id:'application',name:'Application',slug:'application'}];
 const todos={items:[{id:1,text:'Review the visual system',completed:false},{id:2,text:'Verify shared components',completed:true},{id:3,text:'Check mobile layout',completed:false}],nextCursor:null};
 manifest.fixture={source:'apps/web/tests/feedback.spec.ts mockSession and todo/list fixtures',identity,access,spaces,todos};
 for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:theme,locale:'en-US',serviceWorkers:'block'});
  await context.addInitScript(theme=>localStorage.setItem('vite-ui-theme',theme),theme);
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!=='http://127.0.0.1:43111'){manifest.blocked.push(request.url());return route.abort('blockedbyclient');}
   let response;
   if(url.pathname.startsWith('/api/auth/')) response=identity;
   else if(url.pathname==='/rpc/access/me') response={json:access};
   else if(url.pathname==='/rpc/access/mine') response={json:spaces};
   else if(url.pathname==='/rpc/todo/list') response={json:todos};
   if(response){manifest.requests.push({theme,path:url.pathname,method:request.method(),fixture:true});return route.fulfill({json:response});}
   if(url.pathname.startsWith('/rpc/')||url.pathname.startsWith('/api/')){manifest.blocked.push(request.url());return route.abort('blockedbyclient');}
   return route.continue();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>manifest.errors.push({theme,message:error.message}));
  for(const [kind,width] of [['home',1440],['home',390],['todos',1440]]){
   await page.setViewportSize({width,height:1000});
   await page.goto(`http://127.0.0.1:43111/${kind==='home'?'apps':'todos'}?workspace=application`);
   if(kind==='home') await expect(page.getByRole('button',{name:'Todos',exact:true})).toBeVisible();
   else await expect(page.getByText(todos.items[0].text,{exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'Search pages',exact:true})).toBeVisible();
   await page.evaluate(async()=>{await document.fonts.ready;await document.fonts.load('400 14px "Inter Variable"');await document.fonts.load('600 16px "Inter Variable"');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   await page.waitForLoadState('networkidle');
   await expect(page.locator('html')).toHaveClass(new RegExp(theme));
   if(/sign-in/.test(page.url())) throw new Error('Unexpected sign-in page');
   const measurements=await page.evaluate(()=>{
    const el=document.querySelector('button[aria-label="Search pages"]');
    const style=e=>{const s=getComputedStyle(e);return Object.fromEntries(['width','min-width','max-width','height','display','box-sizing','flex','flex-basis','flex-grow','flex-shrink','padding-left','padding-right','gap','font-family','font-size','line-height'].map(k=>[k,s.getPropertyValue(k)]));};
    const rect=e=>e.getBoundingClientRect().toJSON();
    const rules=[];
    const visit=(list,context=[])=>{for(const rule of list){if(rule.selectorText){let matches=false;try{matches=el.matches(rule.selectorText)}catch{};if(matches&&/width|flex|padding|box-sizing/.test(rule.style?.cssText||''))rules.push({selector:rule.selectorText,style:rule.style.cssText,context});}if(rule.cssRules){if(rule.conditionText&&rule.constructor.name==='CSSMediaRule'&&!matchMedia(rule.conditionText).matches)continue;visit(rule.cssRules,[...context,rule.conditionText||rule.name||rule.selectorText||rule.constructor.name]);}}};
    for(const sheet of document.styleSheets){try{visit(sheet.cssRules,[sheet.href||'inline'])}catch{}}
    const baseline={rect:rect(el),computed:style(el),className:el.className,parent:{rect:rect(el.parentElement),computed:style(el.parentElement)},children:[...el.children].map(e=>({tag:e.tagName,className:e.getAttribute('class'),text:e.textContent,rect:rect(e),computed:style(e)})),rules};
    // Diagnostic only: restore style before screenshot; never alter source.
    const original=el.getAttribute('style');
    el.style.setProperty('min-width','0','important');
    const withMinWidthZero={rect:rect(el),computed:style(el)};
    el.style.setProperty('width','40px','important');
    const withWidth40={rect:rect(el),computed:style(el)};
    if(original===null)el.removeAttribute('style');else el.setAttribute('style',original);
    return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},fontStatus:document.fonts.status,interLoaded:document.fonts.check('400 14px "Inter Variable"'),bodyFont:getComputedStyle(document.body).fontFamily,rootFontSize:getComputedStyle(document.documentElement).fontSize,baseline,diagnostic:{withMinWidthZero,withWidth40,restoredRect:rect(el)},card:document.querySelector('[data-slot="card"]')?rect(document.querySelector('[data-slot="card"]')):null};
   });
   const filename=`${kind}-${width}x1000-${theme}.png`;
   await page.screenshot({path:path.join(out,filename),animations:'disabled'});
   manifest.captures.push({filename,theme,kind,url:page.url(),capturedAt:new Date().toISOString(),measurements});
   console.log('CAPTURED',filename,JSON.stringify(measurements.baseline.computed));
  }
  if(theme==='dark'){
   await page.getByRole('button',{name:'Search pages',exact:true}).click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:path.join(out,'search-dialog-1440x1000-dark.png'),animations:'disabled'});
   manifest.captures.push({filename:'search-dialog-1440x1000-dark.png',theme,kind:'search-dialog',url:page.url(),capturedAt:new Date().toISOString()});
  }
  await context.close();
 }
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
