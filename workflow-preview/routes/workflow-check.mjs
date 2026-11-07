import {createHash} from 'node:crypto';
import {defineEventHandler} from 'nitro/h3';
import {start} from 'workflow/api';
import {publishJournal} from '../../workflows/publish-journal.mjs';
import {previewIdentity,previewStore} from '../storage.mjs';

const key='workflow-preview-check-v1';
const iso=ms=>new Date(ms).toISOString();
const json=(value,status=200)=>Response.json(value,{status});
const asObject=row=>row?JSON.parse(row.value):null;
const quote=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const form='<form method="post" action="/workflow-check"><button type="submit">Iniciar ensayo ficticio</button></form>';

export default defineEventHandler(async ({req})=>{
  const identity=previewIdentity();
  const url=new URL(req.url);
  if(!identity||url.host!==identity.host)return json({error:'Not found'},404);
  const method=req.method;
  if(method!=='GET'&&method!=='POST')return json({error:'Method not allowed'},405);
  if(method==='POST'&&req.headers.get('origin')!==url.origin)return json({error:'Origin rejected'},403);
  try{
    const store=await previewStore();
    if(method==='POST'){
      // One small batch per isolated test environment, even across deployments.
      const inserted=await store.pool.query("INSERT INTO journal_settings VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING name",
        [key,JSON.stringify({state:'preparing',originDeployment:identity.deployment})]);
      if(!inserted.rows.length)return json({error:'A test batch already exists'},409);
      const startTime=Date.now();
      const batch={state:'running',startedAt:iso(startTime),originDeployment:identity.deployment,scenarios:[]};
      const armFor=scenario=>async alarm=>{
        const run=await start(publishJournal,[alarm]);
        scenario.alarms.push({generation:alarm.generation,runId:run.runId,scheduledAt:alarm.scheduledAt});
        return run.runId;
      };
      for(const spec of [{name:'direct',delays:[70]}, {name:'duplicate',delays:[85],duplicate:true},
          {name:'reschedule',delays:[45,105]}, {name:'cancel',delays:[55],cancel:true}, {name:'new-deployment',delays:[300]}]){
        const label='workflow-check-'+spec.name+'-'+createHash('sha256').update(identity.deployment).digest('hex').slice(0,8);
        const text={title:'Fictional workflow '+spec.name,summary:'Synthetic Preview only',slug:label,body:'Synthetic test'};
        let article=await store.save({es:text,en:{...text,slug:label+'-en'}});
        const scenario={name:spec.name,id:article.id,alarms:[]};
        for(const delay of spec.delays){
          const scheduledAt=iso(startTime+delay*1000);
          const snapshot={es:article.es,en:article.en,publishedAt:scheduledAt,modifiedAt:scheduledAt};
          const arm=armFor(scenario);
          article=await store.schedule(article.id,article.revision,snapshot,scheduledAt,Date.now(),async alarm=>{
            const runId=await arm(alarm);
            if(spec.duplicate)await arm(alarm);
            return runId;
          });
        }
        if(spec.cancel)article=await store.cancelSchedule(article.id,article.revision);
        scenario.revisionAfterSetup=article.revision;
        batch.scenarios.push(scenario);
      }
      await store.setSetting(key,JSON.stringify(batch));
      console.log('JOURNAL_WORKFLOW_BATCH',JSON.stringify({origin:identity.deployment,scenarios:batch.scenarios.length,
        lastDue:batch.scenarios.at(-1).alarms[0].scheduledAt}));
      return new Response(null,{status:303,headers:{location:'/workflow-check'}});
    }

    // This endpoint only reads storage. It never passes through the Journal
    // request handler, which has a separate on-visit publication fallback.
    const raw=await store.getSetting(key);
    const batch=raw?JSON.parse(raw):{state:'idle'};
    const report={...batch,readerDeployment:identity.deployment};
    if(batch.scenarios){
      report.scenarios=await Promise.all(batch.scenarios.map(async scenario=>{
        const article=await store.get(scenario.id);
        const alarms=await Promise.all(scenario.alarms.map(async alarm=>{
          const evidence=(await store.pool.query('SELECT value FROM journal_settings WHERE name=$1',['workflow-evidence:'+alarm.runId])).rows[0];
          return {...alarm,evidence:asObject(evidence)};
        }));
        return {name:scenario.name,revisionAfterSetup:scenario.revisionAfterSetup,revision:article.revision,
          publishedAt:article.published?.publishedAt??null,languages:Object.keys(article.published??{}).filter(x=>['es','en'].includes(x)),
          pendingAt:article.schedule?.publishAt??null,alarms};
      }));
    }
    if(url.searchParams.get('format')==='json')return json(report);
    return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><title>Journal Workflow Preview</title>'+
      '<h1>Journal Workflow Preview</h1><p>Ensayo de programación. Solo datos ficticios.</p>'+
      (batch.state==='idle'?form:'<a href="/workflow-check">Leer estado</a>')+'<pre>'+quote(JSON.stringify(report,null,2))+'</pre></html>',
      {headers:{'content-type':'text/html; charset=utf-8'}});
  }catch(error){
    const safe=String(error?.name??'Error').replace(/[^A-Za-z]/g,'').slice(0,50);
    console.error('Journal workflow check failed',method,safe);
    return json({error:'Workflow Preview failed',type:safe},503);
  }
});
