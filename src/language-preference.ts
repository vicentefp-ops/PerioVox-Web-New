// A language explicitly selected by the visitor takes precedence on future home visits.
export function installLanguagePreference(){
 document.addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const link=event.target.closest<HTMLAnchorElement>('.language-switch a[hreflang]');
  const language=link?.getAttribute('hreflang');
  if(language!=='es'&&language!=='en')return;
  document.cookie=`pv_web_language=${language}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
 });
}
