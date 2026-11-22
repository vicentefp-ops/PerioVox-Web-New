// Public search snippet for one Journal article. The article body stays in the
// Journal database. This title and description use only claims already on that article.
export const searchSnippets={
 'choosing-voice-periodontal-charting-software':{
  title:'Choose Free Voice Perio Charting Software | PerioVox',
  description:'Seven criteria for hygienists and dentists choosing voice perio charting: probe, languages, corrections and cost. PerioVox is free today and forever.'
 }
};
const escapeAttr=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function replaceMeta(html,attribute,name,value){
 const tags=new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${name}")[^>]*>`,'g');
 return html.replace(tags,tag=>tag.includes('content="')?tag.replace(/content="[^"]*"/,`content="${value}"`):tag);
}
export function applySearchSnippet(html,snippet){
 const title=escapeAttr(snippet.title),description=escapeAttr(snippet.description);
 let next=html.replace(/<title>[^<]*<\/title>/,`<title>${title}</title>`);
 next=replaceMeta(next,'name','description',description);
 next=replaceMeta(next,'property','og:title',title);
 next=replaceMeta(next,'property','og:description',description);
 next=replaceMeta(next,'name','twitter:title',title);
 next=replaceMeta(next,'name','twitter:description',description);
 return next.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,(full,json)=>{
  let data;try{data=JSON.parse(json)}catch{return full}
  const page=(data['@graph']||[]).find(node=>node['@type']==='WebPage');
  if(!page)return full;
  page.name=snippet.title;page.description=snippet.description;
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
 });
}
