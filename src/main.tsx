import {StrictMode} from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {findRoute} from './resources-content';
import {installConversionTracking} from './analytics';
import './index.css';
const route=findRoute(window.location.pathname);
const lang=route?.lang??(window.location.pathname.startsWith('/es')?'es':'en');
const root=document.getElementById('root')!;
async function start(){
 const isJournal=/^\/(es\/)?journal(?:\/|$)/.test(window.location.pathname);
 const admin=/^\/(es\/)?journal\/admin\/?$/.test(window.location.pathname);
 if(!route&&!isJournal){location.replace('/404.html');return}
 let page;
 if(isJournal){
  if(admin){const {default:JournalAdmin}=await import('./JournalAdmin');page=<JournalAdmin/>}
  else{const {default:Journal}=await import('./Journal');const initial=document.getElementById('journal-data');const props=initial?JSON.parse(initial.textContent||'{}'):{lang,posts:[]};page=<Journal {...props}/>}
 }
 else if(route&&route.kind!=='home'){const {default:Resources}=await import('./Resources');page=<Resources route={route}/>}
 else{const {default:App}=await import('./App');page=<App lang={lang}/>}
 const app=<StrictMode>{page}</StrictMode>;
 if(root.hasChildNodes())hydrateRoot(root,app);else createRoot(root).render(app);
 if(!admin)installConversionTracking();
}
void start();
