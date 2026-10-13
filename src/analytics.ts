const GA='G-3EV0RZHYDN';
export function trackConversion(link:HTMLAnchorElement){
 const w=window as typeof window&{gtag?:(...args:unknown[])=>void;[key:string]:unknown};
 if(!/(^|\.)periovox\.ai$/.test(location.hostname)||w[`ga-disable-${GA}`]!==false||typeof w.gtag!=='function')return;
 try{const consent=JSON.parse(localStorage.getItem('periovox-cookie-consent')||'null');if(consent?.status!=='set'||consent.analytics!==true||!consent.updatedAt||!(Date.now()-Date.parse(consent.updatedAt)<183*86400000))return}catch{return}
 const url=new URL(link.href,location.href);let event:string|undefined;
 if(url.hostname==='app.periovox.ai')event=link.dataset.conversion==='start_free'?'start_free_click':'app_open';
 else if(url.protocol==='mailto:'&&url.pathname==='info@periovox.ai')event=link.closest('#integrations')||location.pathname.includes('integration')||location.pathname.includes('integracion')?'integration_contact':'email_contact';
 else if(url.hostname==='wa.me')event='whatsapp_contact';
 if(event)w.gtag('event',event,{page_language:document.documentElement.lang,page_path:location.pathname,section:link.closest('section')?.id||'navigation',transport_type:'beacon'});
}
export function installConversionTracking(){
 const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(target)trackConversion(target)};
 document.addEventListener('click',click);return()=>document.removeEventListener('click',click);
}
