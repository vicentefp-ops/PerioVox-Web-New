// Titles for the articles published when this list was added. New sitemap URLs still appear; unknown ones use the slug.
const known={
 'https://periovox.ai/es/journal/periovox-incorpora-el-protocolo-gbt-en-espana-tras-un-acuerdo-con-ems/':'PerioVox incorpora el protocolo GBT en España tras un acuerdo con EMS',
 'https://periovox.ai/journal/periovox-incorporates-gbt-protocol-spain-ems/':'PerioVox Incorporates the GBT Protocol in Spain Following an Agreement with EMS',
 'https://periovox.ai/es/journal/periovox-google-for-startups-cloud-program/':'PerioVox se incorpora al Google for Startups Cloud Program',
 'https://periovox.ai/journal/periovox-google-for-startups-cloud-program/':'PerioVox Joins the Google for Startups Cloud Program',
 'https://periovox.ai/es/journal/elegir-software-periodontograma-voz/':'Periodontograma por voz: 7 criterios para elegir software',
 'https://periovox.ai/journal/choosing-voice-periodontal-charting-software/':'Voice Periodontal Charting: 7 Criteria for Choosing Software',
 'https://periovox.ai/es/journal/por-que-periovox-por-que-ahora/':'Por qué PerioVox, por qué ahora',
 'https://periovox.ai/journal/why-periovox-why-now/':'Why PerioVox, Why Now'
};
export const fallbackJournalUrls=Object.keys(known);
function label(url){
 if(known[url])return known[url];
 const slug=url.split('/').filter(Boolean).pop()??url;
 return slug.replace(/-/g,' ');
}
function lines(urls){return urls.map(url=>`- [${label(url)}](${url})`)}
export async function journalArticleLines(){
 try{
  const response=await fetch('https://periovox.ai/sitemap-journal.xml',{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const xml=await response.text();
  const urls=[...xml.matchAll(/<loc>\s*(https:\/\/periovox\.ai\/(?:es\/)?journal\/[a-z0-9-]+\/)\s*<\/loc>/g)].map(match=>match[1]);
  if(!urls.length)throw new Error('sitemap has no article URLs');
  return {source:'https://periovox.ai/sitemap-journal.xml',lines:lines(urls)};
 }catch(error){
  console.warn('Journal sitemap unavailable; using the committed article list.',error instanceof Error?error.message:error);
  return {source:'fallback',lines:lines(fallbackJournalUrls)};
 }
}
