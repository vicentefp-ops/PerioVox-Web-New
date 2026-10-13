import {useState} from 'react';
import {ArrowUpRight,ArrowLeft,BookOpen} from 'lucide-react';
import {copy} from './translations';
import {resourceCopy} from './resources-content';
import {ResourceCards,ResourceFooterLinks} from './ResourceLinks';
import CookieConsent from './CookieConsent';
import JournalBody from './JournalBody';
import {journalCopy,journalPath,postPath,type JournalProps} from './journal-model';
import {journalSchema} from './journal-seo';
import './resources.css';
import './journal.css';
const date=(value:string,lang:string)=>new Date(value).toLocaleDateString(lang==='es'?'es-ES':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'});
export function JournalArticle({post,lang}:{post:NonNullable<JournalProps['post']>;lang:JournalProps['lang']}){
 const t=journalCopy[lang],text=post[lang]!;const minutes=Math.max(1,Math.ceil(text.body.split(/\s+/).length/220));
 return <article className="journal-article">
  <header className="journal-article-head"><a className="journal-back" href={journalPath(lang)}><ArrowLeft size={15}/>{t.back}</a><p className="eyebrow"><span/>{t.categories[post.category]??t.categories.guides}</p><h1>{text.title}</h1><p className="journal-subtitle">{text.summary}</p><div className="journal-byline"><span>{t.author} {post.author==='Equipo PerioVox'&&lang==='en'?'PerioVox team':post.author}</span><time dateTime={post.publishedAt}>{date(post.publishedAt,lang)}</time><span>{minutes} {t.minutes}</span></div>{post.reviewer&&<p className="journal-reviewer">{t.reviewer}: {post.reviewer}</p>}</header>
  {post.cover&&<figure className="journal-cover"><img src={post.cover} alt={text.coverAlt} fetchPriority="high"/>{text.coverAlt&&<figcaption>{text.coverAlt}</figcaption>}</figure>}
  <div className="journal-article-layout"><aside><span>PERIOVOX JOURNAL</span><p>{t.categories[post.category]??t.categories.guides}</p></aside><div><JournalBody body={text.body}/>{post.modifiedAt!==post.publishedAt&&<p className="journal-updated">{t.updated}: <time dateTime={post.modifiedAt}>{date(post.modifiedAt,lang)}</time></p>}</div></div>
 </article>;
}
export default function Journal({lang,posts,post}:JournalProps){
 const t=journalCopy[lang],c=copy[lang],home=lang==='es'?'/es/':'/';const [settings,setSettings]=useState(false);const en=post?.en?postPath(post,'en'):'/journal/';const es=post?.es?postPath(post,'es'):'/es/journal/';
 return <div className="resource-page journal-page" id="top"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(journalSchema({lang,posts,post})).replace(/</g,'\\u003c')}}/><a className="skip-link" href="#main">{lang==='es'?'Saltar al contenido':'Skip to content'}</a>
  <header className="site-header light resource-header journal-header"><div className="header-inner"><a className="brand" href={home} aria-label="PerioVox"><img src="/media/logo-periovox-transparent.svg" width="598" height="184" alt="PerioVox"/></a><nav className="resource-header-nav" aria-label={lang==='es'?'Navegación principal':'Main navigation'}><a href={home}>{t.home}</a><a href={resourceCopy[lang].path}>{t.resources}</a><a href={journalPath(lang)} className="journal-nav-link" aria-current="page">Journal</a></nav><div className="header-actions"><div className="language-switch"><a href={es} lang="es" hrefLang="es" aria-current={lang==='es'?'page':undefined}>ES</a><i>/</i><a href={en} lang="en" hrefLang="en" aria-current={lang==='en'?'page':undefined}>EN</a></div><a href="https://app.periovox.ai/" data-conversion="start_free" className="login">{c.start}<ArrowUpRight size={15}/></a></div></div></header>
  <main id="main" className="section-wrap journal-main">
   {post?<JournalArticle post={post} lang={lang}/>:<><header className="journal-intro"><p className="eyebrow"><span/>PERIOVOX JOURNAL</p><h1>{t.heading.split('\n').map((line,i)=><span key={line}>{i>0&&<br/>}{line}</span>)}</h1><p>{t.intro}</p><div className="journal-intro-bottom"><span>{t.label}</span><BookOpen size={23} strokeWidth={1.2}/></div></header>
   <section className="journal-latest" aria-labelledby="journal-latest"><h2 id="journal-latest">{t.latest}</h2>{posts.length?<div className="journal-grid">{posts.map(item=><a className="journal-card" key={item.id} href={postPath(item,lang)}>{item.cover?<div className="journal-card-image"><img src={item.cover} alt={item[lang]!.coverAlt} loading="lazy"/></div>:<div className="journal-card-placeholder"><BookOpen strokeWidth={.8}/><span>PERIOVOX JOURNAL</span></div>}<div className="journal-card-copy"><span className="journal-card-category">{t.categories[item.category]??t.categories.guides}</span><h3>{item[lang]!.title}</h3><p>{item[lang]!.summary}</p><span className="journal-card-bottom"><time dateTime={item.publishedAt}>{date(item.publishedAt,lang)}</time><ArrowUpRight size={21}/></span></div></a>)}</div>:<div className="journal-empty"><span>01 / JOURNAL</span><h3>{t.empty}</h3><p>{t.emptyText}</p></div>}</section></>}
   <section className="journal-guides"><p className="eyebrow"><span/>{t.resources}</p><div className="section-intro"><h2>{post?t.related:t.guides}</h2><p>{t.guidesText}</p></div><ResourceCards lang={lang}/></section>
   <section className="resource-cta"><p className="eyebrow"><span/>PERIOVOX</p><h2>{t.cta}</h2><p>{t.ctaText}</p><a className="button" data-conversion="start_free" href="https://app.periovox.ai/">{t.start}<ArrowUpRight size={18}/></a></section>
  </main><footer className="footer resource-footer section-wrap"><ResourceFooterLinks lang={lang}/><div className="resource-footer-bottom"><a href="mailto:info@periovox.ai">info@periovox.ai</a><a href="/journal/admin/" rel="nofollow">{t.editor}</a><a href={'/terms-of-use.html#'+lang}>{c.terms}</a><a href={'/privacy-notice.html#'+lang}>{c.privacy}</a><a href={'/cookie-policy.html#'+lang}>{c.cookies}</a><button onClick={()=>setSettings(true)}>{c.cookieSettings}</button></div><p className="disclaimer">© 2026 PerioVox · Novik Nexus</p></footer><CookieConsent lang={lang} settingsOpen={settings} closeSettings={()=>setSettings(false)}/>
 </div>;
}
