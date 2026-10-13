import {useEffect, useRef, useState} from 'react';
import {X,Check} from 'lucide-react';
import {copy,type Language} from './translations';
type Consent={status:'unset'|'set';necessary:true;preferences:boolean;analytics:boolean;advertising:boolean;updatedAt:string|null};
const initial:Consent={status:'unset',necessary:true,preferences:false,analytics:false,advertising:false,updatedAt:null};
const KEY='periovox-cookie-consent';const GA='G-3EV0RZHYDN';
function read():Consent{try{const value=JSON.parse(localStorage.getItem(KEY)||'null');if(value?.status==='set'&&Date.now()-Date.parse(value.updatedAt)<183*86400000)return {...initial,status:'set',preferences:!!value.preferences,analytics:!!value.analytics,advertising:!!value.advertising,updatedAt:value.updatedAt}}catch{}return initial}
function sync(value:Consent){
 const w=window as any;w[`ga-disable-${GA}`]=!value.analytics;
 const permissions={analytics_storage:value.analytics?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:value.preferences?'granted':'denied',security_storage:'granted'};
 w.gtag?.('consent','update',permissions);
 if(!value.analytics){for(const cookie of document.cookie.split(';')){const name=cookie.trim().split('=')[0];if(name.startsWith('_ga'))for(const domain of ['',location.hostname,`.${location.hostname}`,'.periovox.ai'])document.cookie=`${name}=; Max-Age=0; path=/;${domain?` domain=${domain};`:''}`}}
 if(value.analytics&&/(^|\.)periovox\.ai$/.test(location.hostname)&&!w.__pvGaLoaded){
  w.__pvGaLoaded=true;w.dataLayer=w.dataLayer||[];w.gtag=function(){w.dataLayer.push(arguments)};
  w.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',security_storage:'granted'});
  w.gtag('consent','update',permissions);w.gtag('js',new Date());w.gtag('config',GA);
  const script=document.createElement('script');script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${GA}`;document.head.append(script);
 }
}
export default function CookieConsent({lang,settingsOpen,closeSettings}:{lang:Language;settingsOpen:boolean;closeSettings:()=>void}){
 const t=copy[lang];const c=t.cookie;const [value,setValue]=useState<Consent>(initial);const [banner,setBanner]=useState(false);const [open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const saved=read();setValue(saved);setBanner(saved.status!=='set');sync(saved)},[]);
 useEffect(()=>{if(settingsOpen){setValue(read());setOpen(true)}},[settingsOpen]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
 function close(){setOpen(false);closeSettings()}
 function persist(next:Consent){const saved:Consent={...next,status:'set',necessary:true,updatedAt:new Date().toISOString()};try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{}setValue(saved);sync(saved);setBanner(false);close()}
 const reject=()=>persist({...initial});const accept=()=>persist({...initial,preferences:true,analytics:true,advertising:true});
 return <>{banner&&!open&&<aside className="cookie-banner" aria-label={c.title}><div><h2>{c.title}</h2><p>{c.text} <a href={`/cookie-policy.html${lang==='es'?'#es':'#en'}`}>{t.cookies}</a></p></div><div className="cookie-actions"><button onClick={reject}>{c.reject}</button><button onClick={()=>setOpen(true)}>{c.manage}</button><button className="cookie-primary" onClick={accept}>{c.accept}</button></div></aside>}
 <dialog ref={dialog} className="cookie-dialog" aria-labelledby="cookie-title" onCancel={close} onClose={()=>{if(open)close()}}><button className="dialog-close" aria-label={c.close} onClick={close}><X size={20}/></button><span className="eyebrow">PERIOVOX / PRIVACY</span><h2 id="cookie-title">{c.title}</h2><p>{c.text}</p><div className="cookie-categories">{(['necessary','preferences','analytics','advertising'] as const).map((key,i)=><label key={key}><span><strong>{c.categories[i]}</strong><small>{c.descriptions[i]}</small></span><input type="checkbox" disabled={key==='necessary'} checked={value[key]} onChange={e=>setValue({...value,[key]:e.target.checked})}/></label>)}</div><a href={`/cookie-policy.html${lang==='es'?'#es':'#en'}`}>{t.cookies}</a><div className="cookie-actions"><button onClick={reject}>{c.reject}</button><button className="cookie-primary" onClick={()=>persist(value)}>{c.save}<Check size={15}/></button></div></dialog></>
}
