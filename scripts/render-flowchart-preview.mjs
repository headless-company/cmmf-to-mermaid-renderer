import {chromium} from '../../cmmf-visual-editor/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'artifacts/ecommerce-flowchart');
const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.goto(origin+'/README.md');
await page.evaluate(async()=>{window.mermaid=(await import('/.tmp/mermaid-tools/node_modules/mermaid/dist/mermaid.esm.min.mjs')).default;window.mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',flowchart:{useMaxWidth:false,htmlLabels:false,curve:'linear'}});});
const charts=[];
for(const [i,id]of ['ecommerce-flowchart','product-flowchart'].entries()){
 const source=await readFile(path.join(out,id+'.mmd'),'utf8');
 const result=await page.evaluate(async({source,i})=>{
  const diagram=await window.mermaid.mermaidAPI.getDiagramFromText(source);
  const edges=diagram.db.getEdges();
  const relationships=edges.filter(edge=>edge.stroke!=='invisible');
  if(relationships.some(edge=>!/^m\d+_f\d+$/.test(edge.start)||!/^m\d+$/.test(edge.end)))throw Error('Relationship endpoint is not field → model: '+JSON.stringify(edges.slice(0,3)));
  const {svg}=await window.mermaid.render('preview'+i,source);document.body.innerHTML=svg;document.body.style.margin='0';
  const el=document.querySelector('svg'),vb=el.viewBox.baseVal;
  return {svg,width:vb.width,height:vb.height,relationships:relationships.length,edges:edges.length,nodes:document.querySelectorAll('g.node').length};
 },{source,i});
 await writeFile(path.join(out,id+'.svg'),result.svg);
 await page.evaluate(({width,height})=>{const el=document.querySelector('svg');const scale=Math.min(1400/width,960/height,1);el.style.width=width*scale+'px';el.style.height=height*scale+'px';},{width:result.width,height:result.height});
 await page.screenshot({path:path.join(out,id+'-fit.png')});
 if(i===1){await page.evaluate(()=>{const el=document.querySelector('svg');el.style.width=el.viewBox.baseVal.width+'px';el.style.height=el.viewBox.baseVal.height+'px';const node=document.querySelector('[id^="flowchart-m20_f"]')??document.querySelector('g.node');node.scrollIntoView({block:'center',inline:'center'});});await page.screenshot({path:path.join(out,'field-detail.png')});}
 charts.push({id,source,...result});console.log(JSON.stringify({...result,svg:undefined,id}));
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Ecommerce flowchart preview</title><style>body{margin:0;font:15px system-ui;background:#f6f5f2;color:#25233b}header{padding:18px 24px}h1{font-size:22px;margin:0 0 8px}p{margin:6px 0}button,select{padding:7px;font:inherit;margin-right:8px}#viewport{height:65vh;overflow:auto;background:white;padding:12px}#space{position:relative}#diagram{position:absolute;transform-origin:0 0}svg{max-width:none!important}textarea{box-sizing:border-box;width:100%;height:180px;font:12px monospace}footer{padding:16px 24px}a{color:#51438d}</style><header><h1>Ecommerce · field connections experiment</h1><p>34 content types · 201 fields · 64 relationships. Each relationship starts at its reference or object field node.</p><p>Solid arrows = references. Dashed arrows = embedded objects. Purple nodes = references; green = objects.</p><select id="view"><option>Full ecommerce example</option><option>Product and direct neighbours</option></select><button id="fit">Fit</button><button id="actual">100%</button><button id="minus">−</button><button id="plus">+</button><button id="copy">Copy Mermaid source</button><span id="status"></span></header><div id="viewport"><div id="space"><div id="diagram"></div></div></div><footer><p>Paste the source below into your Mermaid tool. This is a flowchart prototype; fields are separate nodes rather than table rows. <a id="download">Open .mmd file</a></p><textarea id="source" aria-label="Mermaid source" readonly></textarea></footer><script>const charts=${JSON.stringify(charts).replaceAll('<','\\u003c')};const $=id=>document.getElementById(id);let chart,scale;function zoom(n){scale=Math.max(.005,Math.min(2,n));$('diagram').style.transform='scale('+scale+')';$('space').style.width=chart.width*scale+'px';$('space').style.height=chart.height*scale+'px';$('status').textContent=Math.round(scale*100)+'% · '+Math.round(chart.width)+' × '+Math.round(chart.height)+'px';}function fit(){zoom(Math.min(($('viewport').clientWidth-24)/chart.width,($('viewport').clientHeight-24)/chart.height,1));$('viewport').scrollTo(0,0);}function show(){chart=charts[$('view').selectedIndex];$('diagram').innerHTML=chart.svg;const svg=$('diagram').querySelector('svg');svg.style.width=chart.width+'px';svg.style.height=chart.height+'px';$('source').value=chart.source;$('download').href=chart.id+'.mmd';fit();}$('view').onchange=show;$('fit').onclick=fit;$('actual').onclick=()=>zoom(1);$('minus').onclick=()=>zoom(scale/1.25);$('plus').onclick=()=>zoom(scale*1.25);$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(chart.source);$('copy').textContent='Copied';}catch{$('source').select();document.execCommand('copy');$('copy').textContent='Source selected / copied';}};show();</script></html>`;
await writeFile(path.join(out,'index.html'),html);
await writeFile(path.join(out,'render-metrics.json'),JSON.stringify(charts.map(({id,width,height,relationships,edges,nodes})=>({id,width,height,relationships,edges,nodes,mermaidVersion:'11.12.0'})),null,2)+'\n');
await page.goto(origin+'/artifacts/ecommerce-flowchart/index.html');await page.screenshot({path:path.join(out,'preview.png')});
await page.selectOption('#view',{index:1});if((await page.locator('#source').inputValue())!==charts[1].source)throw Error('Source selector failed');console.log('Viewer source selection verified');
}finally{await browser?.close();server.close();}
