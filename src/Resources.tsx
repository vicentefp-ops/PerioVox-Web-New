import {useState} from 'react';
import {ArrowUpRight,Plus} from 'lucide-react';
import {copy} from './translations';
import {resourceCopy,published,type SiteRoute} from './resources-content';
import {pageSchema} from './seo';
import {ResourceCards,ResourceFooterLinks} from './ResourceLinks';
import CookieConsent from './CookieConsent';
import './resources.css';

export default function Resources({route}:{route:SiteRoute}){
 const {lang,guide}=route;const t=resourceCopy[lang];const c=copy[lang];const home=lang==='es'?'/es/':'/';const [cookieSettings,setCookieSettings]=useState(false);
 return <div id="top" className="resource-page">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(pageSchema(route)).replace(/</g,'\\u003c')}}/>
  <a className="skip-link" href="#main">{lang==='es'?'Saltar al contenido':'Skip to content'}</a>
  <header className="site-header light resource-header"><div className="header-inner"><a className="brand" href={home} aria-label="PerioVox"><img src="/media/logo-periovox-transparent.svg" width="598" height="184" alt="PerioVox"/></a><nav className="resource-header-nav" aria-label={c.menu}><a href={home+'#how'}>{c.nav[0]}</a><a href={home+'#platform'}>{c.nav[1]}</a><a href={t.path} aria-current={!guide?'page':undefined}>{t.nav}</a><a href={lang==='es'?'/es/journal/':'/journal/'} className="journal-nav-link">Journal</a></nav><div className="header-actions"><div className="language-switch"><a href={lang==='es'?route.path:route.alternate} lang="es" hrefLang="es" aria-current={lang==='es'?'page':undefined}>ES</a><i>/</i><a href={lang==='en'?route.path:route.alternate} lang="en" hrefLang="en" aria-current={lang==='en'?'page':undefined}>EN</a></div><a className="login" data-conversion="start_free" href="https://app.periovox.ai/">{c.start}<ArrowUpRight size={15}/></a></div></div></header>
  <main id="main" className="resource-main section-wrap">
   <nav className="breadcrumbs" aria-label={lang==='es'?'Ruta de navegación':'Breadcrumb'}><ol><li><a href={home}>{t.home}</a></li><li>{guide?<a href={t.path}>{t.nav}</a>:<span aria-current="page">{t.nav}</span>}</li>{guide&&<li><span aria-current="page">{guide.h1}</span></li>}</ol></nav>
   <header className="resource-intro"><p className="eyebrow"><span/>{guide?.label??t.label}</p><h1>{guide?.h1??t.heading}</h1><p className="resource-summary">{guide?.summary??t.intro}</p>{guide&&<div className="resource-byline"><span>{t.by}</span><time dateTime={published}>{lang==='es'?'Publicado el ':'Published '}{new Intl.DateTimeFormat(lang==='es'?'es-ES':'en-US',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(published))}</time>{guide.updated&&<time dateTime={guide.updated}>{lang==='es'?'Actualizado el ':'Updated '}{new Intl.DateTimeFormat(lang==='es'?'es-ES':'en-US',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(guide.updated))}</time>}</div>}</header>
   {guide?<article aria-label={guide.h1}>
    <figure className={`guide-visual guide-visual--${guide.id}`}><img src={guide.image} width={guide.width} height={guide.height} alt={guide.imageAlt} loading="lazy" decoding="async"/><figcaption>{guide.caption}</figcaption></figure>
    <div className="guide-layout"><aside className="guide-toc"><nav aria-label={t.contents}><span>{t.contents}</span><ol>{guide.sections.map(section=><li key={section.id}><a href={'#'+section.id}>{section.title}</a></li>)}</ol></nav></aside><div className="guide-body">
     {guide.sections.map(section=><section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs?.map(p=><p key={p}>{p}</p>)}{section.list&&<ul>{section.list.map(item=><li key={item}>{item}</li>)}</ul>}{section.example&&<p className="guide-callout">{section.example}</p>}{section.table&&<div className="guide-table"><table><thead><tr>{section.table.headers.map(header=><th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{section.table.rows.map(row=><tr key={row[0]}>{row.map((cell,i)=>i===0?<th scope="row" key={i}>{cell}</th>:<td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>}{guide.id==='comparisons'&&['visitas','visits'].includes(section.id)&&<figure className="guide-trend"><img src="/media/comparativa-4.webp" width="2328" height="812" alt={c.comparisonTrendAlt} loading="lazy" decoding="async"/><figcaption>{c.comparisonCaptions[1]}</figcaption></figure>}</section>)}
     <section id="questions" className="guide-faq"><h2>{t.faq}</h2><div className="faq-items">{guide.faq.map(([q,a])=><details key={q}><summary><h3>{q}</h3><Plus size={18} aria-hidden="true"/></summary><p>{a}</p></details>)}</div></section>
     {guide.sources&&<section className="guide-sources"><h2>{t.sources}</h2><ul>{guide.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={15} aria-hidden="true"/></a></li>)}</ul></section>}
     <p className="guide-note">{t.note}</p>
    </div></div>
    <section className="guide-related"><h2>{t.related}</h2><ResourceCards lang={lang} exclude={guide.id}/></section>
   </article>:<ResourceCards lang={lang}/>}
   <section className="resource-cta"><p className="eyebrow"><span/>PERIOVOX</p><h2>{t.cta}</h2><p>{t.ctaText}</p><a className="button" data-conversion="start_free" href="https://app.periovox.ai/">{c.start}<ArrowUpRight size={19}/></a><a className="text-link" href={home+'#chart'}>{c.discover}<ArrowUpRight size={18}/></a></section>
  </main>
  <footer className="footer resource-footer section-wrap"><ResourceFooterLinks lang={lang}/><div className="resource-footer-bottom"><a href="mailto:info@periovox.ai">info@periovox.ai</a><a href="https://wa.me/34690957910" target="_blank" rel="noreferrer">WhatsApp</a><a href={'/terms-of-use.html#'+lang}>{c.terms}</a><a href={'/privacy-notice.html#'+lang}>{c.privacy}</a><a href={'/cookie-policy.html#'+lang}>{c.cookies}</a><button onClick={()=>setCookieSettings(true)}>{c.cookieSettings}</button></div><p className="disclaimer">© 2026 PerioVox · Novik Nexus · {c.disclaimer}</p></footer>
  <a className="whatsapp" href="https://wa.me/34690957910" target="_blank" rel="noreferrer" aria-label={c.whatsapp}><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 .9A14.7 14.7 0 0 0 3.3 23l-2 7.3 7.5-2A14.7 14.7 0 1 0 16 .9m0 26.8c-2.1 0-4.2-.6-6-1.6l-.4-.2-4.5 1.2 1.2-4.4-.3-.5A12.1 12.1 0 1 1 16 27.7m6.6-9c-.4-.2-2.2-1.1-2.6-1.2-.3-.1-.6-.2-.8.2l-1.2 1.5c-.2.3-.4.3-.8.1-1.8-.9-3.3-2.2-4.3-3.9-.3-.4.3-.7.9-1.5.1-.2.1-.5 0-.7l-1.2-2.9c-.3-.7-.7-.6-1-.6h-.8c-.3 0-.7.1-1 .5-2.5 2.7-.4 6 1.9 8.5 2 2.1 4.6 3.7 7.5 4.4 1 .3 2 .2 2.7-.2.8-.4 2.2-1.3 2.5-2.5.2-1.2.2-2.1 0-2.3-.1-.1-.4-.2-.8-.4Z"/></svg></a>
  <CookieConsent lang={lang} settingsOpen={cookieSettings} closeSettings={()=>setCookieSettings(false)}/>
 </div>
}
