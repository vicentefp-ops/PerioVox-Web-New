import {copy,type Language} from './translations';
import {journalCopy} from './journal-model';
import {guides,resourceCopy,updated,type SiteRoute} from './resources-content';

export const ORIGIN='https://periovox.ai';
const brand=`${ORIGIN}/#brand`,software=`${ORIGIN}/#software`,website=`${ORIGIN}/#website`;
export const homeMeta={
 es:{title:'Periodontograma por voz gratis para siempre | PerioVox',description:'Crea tu periodontograma por voz con PerioVox. Gratis hoy y siempre. Dictado en 97 idiomas, comparativas e informes por QR. Con tu sonda habitual.'},
 en:{title:'Free Periodontal Charting Software by Voice | PerioVox',description:'Create periodontal charts by voice with PerioVox. Free today and forever. Dictation in 97 languages, visit comparisons and QR reports. No special probe.'}
};
export function metadata(route:SiteRoute){
 const data=route.kind==='home'?homeMeta[route.lang]:route.kind==='resources'?resourceCopy[route.lang]:route.kind==='journal'?journalCopy[route.lang]:route.guide!;
 return {title:data.title,description:data.description,url:ORIGIN+route.path,image:ORIGIN+(route.guide?.image??'/media/hero-poster.jpg'),imageAlt:route.guide?.imageAlt??(route.lang==='es'?'Registro periodontal por voz con PerioVox':'Voice periodontal charting with PerioVox')};
}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function headMarkup(route:SiteRoute){
 const m=metadata(route);const en=ORIGIN+(route.lang==='en'?route.path:route.alternate);const es=ORIGIN+(route.lang==='es'?route.path:route.alternate);
 return `<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escape(m.title)}</title><meta name="description" content="${escape(m.description)}"/>
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/><meta name="theme-color" content="#03254f"/>
<link rel="canonical" href="${m.url}"/><link rel="alternate" hreflang="en" href="${en}"/><link rel="alternate" hreflang="es" href="${es}"/><link rel="alternate" hreflang="x-default" href="${en}"/>
<link rel="icon" href="/favicon.png" type="image/png"/><link rel="preload" href="/fonts/montserrat-600.woff2" as="font" type="font/woff2" crossorigin/>
${route.kind==='home'?'<link rel="preload" href="/media/hero-poster.jpg" as="image" fetchpriority="high"/>':''}
<meta property="og:type" content="${route.kind==='guide'?'article':'website'}"/><meta property="og:site_name" content="PerioVox"/><meta property="og:locale" content="${route.lang==='es'?'es_ES':'en_US'}"/><meta property="og:locale:alternate" content="${route.lang==='es'?'en_US':'es_ES'}"/><meta property="og:url" content="${m.url}"/>
<meta property="og:title" content="${escape(m.title)}"/><meta property="og:description" content="${escape(m.description)}"/><meta property="og:image" content="${m.image}"/><meta property="og:image:alt" content="${escape(m.imageAlt)}"/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escape(m.title)}"/><meta name="twitter:description" content="${escape(m.description)}"/><meta name="twitter:image" content="${m.image}"/><meta name="twitter:image:alt" content="${escape(m.imageAlt)}"/>`;
}
function entities(lang:Language){return [
 {'@type':'Organization','@id':brand,name:'PerioVox',url:ORIGIN+'/',logo:ORIGIN+'/media/logo-periovox.png',email:'info@periovox.ai',sameAs:['https://facebook.com/periovox','https://www.instagram.com/periovox.ai','https://www.linkedin.com/company/periovox-ai/']},
 {'@type':['SoftwareApplication','WebApplication'],'@id':software,name:'PerioVox',applicationCategory:'HealthApplication',operatingSystem:'Web browser',url:'https://app.periovox.ai/',inLanguage:['es','en','fr'],isAccessibleForFree:true,description:lang==='es'?'Software gratuito de periodontogramas por voz para profesionales dentales. Dictado en 97 idiomas, comparativas entre visitas, Lang, IDRA, informes por QR y exportación CSV.':'Free voice periodontal charting software for dental professionals. Dictation in 97 languages, visit comparisons, Lang, IDRA, QR patient reports and CSV export.',offers:{'@type':'Offer',price:0,priceCurrency:'EUR',url:'https://app.periovox.ai/'},publisher:{'@id':brand},featureList:lang==='es'?['Registro periodontal por voz','Dictado en 97 idiomas','Nomenclatura ADA y FDI','Comparativas entre visitas','Diagramas Lang e IDRA','Informes para pacientes con QR','Exportación CSV']:['Voice periodontal charting','Dictation in 97 languages','ADA and FDI tooth numbering','Visit comparisons','Lang and IDRA diagrams','Patient reports with QR access','CSV export']},
 {'@type':'WebSite','@id':website,name:'PerioVox',url:ORIGIN+'/',inLanguage:['es','en'],publisher:{'@id':brand}}
]}
export function pageSchema(route:SiteRoute){
 const {lang,kind,guide}=route;const m=metadata(route);const rc=resourceCopy[lang];const pageId=m.url+'#webpage';
 const graph:Record<string,unknown>[]=entities(lang);
 graph.push({'@type':kind==='resources'?'CollectionPage':'WebPage','@id':pageId,url:m.url,name:m.title,description:m.description,inLanguage:lang,isPartOf:{'@id':website},publisher:{'@id':brand},about:{'@id':software},dateModified:updated,primaryImageOfPage:{'@type':'ImageObject',url:m.image},...(kind==='home'?{mainEntity:{'@id':software}}:{breadcrumb:{'@id':m.url+'#breadcrumbs'}})});
 if(kind!=='home'){
  const items=[{name:rc.home,item:ORIGIN+(lang==='es'?'/es/':'/')},{name:rc.nav,item:ORIGIN+rc.path},...(guide?[{name:guide.h1,item:m.url}]:[])];
  graph.push({'@type':'BreadcrumbList','@id':m.url+'#breadcrumbs',itemListElement:items.map((item,i)=>({'@type':'ListItem',position:i+1,...item}))});
 }
 if(kind==='resources')graph.push({'@type':'ItemList','@id':m.url+'#guides',itemListElement:guides[lang].map((item,i)=>({'@type':'ListItem',position:i+1,name:item.h1,url:ORIGIN+item.path}))});
 if(guide)graph.push({'@type':'Article','@id':m.url+'#article',headline:guide.h1,description:guide.summary,inLanguage:lang,mainEntityOfPage:{'@id':pageId},author:{'@id':brand},publisher:{'@id':brand},dateModified:updated,image:[m.image],isAccessibleForFree:true,...(guide.sources?{citation:guide.sources.map(source=>source.url)}:{})});
 const faq=kind==='home'?copy[lang].faq:guide?.faq;
 if(faq)graph.push({'@type':'FAQPage','@id':m.url+'#faq',isPartOf:{'@id':pageId},inLanguage:lang,mainEntity:faq.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))});
 return {'@context':'https://schema.org','@graph':graph};
}
export function homeSchema(lang:Language){return pageSchema({lang,kind:'home',path:lang==='es'?'/es/':'/',alternate:lang==='es'?'/':'/es/'})}
