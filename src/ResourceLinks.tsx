import {ArrowUpRight} from 'lucide-react';
import type {Language} from './translations';
import {guides,resourceCopy} from './resources-content';

export function ResourceCards({lang,exclude}:{lang:Language;exclude?:string}){
 const t=resourceCopy[lang];return <div className="resource-cards">{guides[lang].filter(guide=>guide.id!==exclude).map((guide,i)=><a className="resource-card" href={guide.path} key={guide.id}><span className="resource-card-top"><span>0{i+1}</span><ArrowUpRight size={22} aria-hidden="true"/></span><h3>{guide.h1}</h3><p>{guide.description}</p><span className="resource-card-cta">{t.read}</span></a>)}</div>
}
export function ResourcesTeaser({lang}:{lang:Language}){const t=resourceCopy[lang];return <section id="resources" className="resources-teaser section-wrap" aria-labelledby="resources-title"><p className="eyebrow"><span/>{t.label}</p><div className="section-intro"><h2 id="resources-title">{t.heading}</h2><p>{t.intro}</p></div><ResourceCards lang={lang}/><a href={t.path} className="text-link">{t.nav}<ArrowUpRight size={18} aria-hidden="true"/></a></section>}
export function ResourceFooterLinks({lang}:{lang:Language}){const t=resourceCopy[lang];return <nav className="footer-resources" aria-label={t.nav}><a href={lang==='es'?'/es/journal/':'/journal/'}>Journal<ArrowUpRight size={15} aria-hidden="true"/></a><a href={t.path}>{t.nav}<ArrowUpRight size={15} aria-hidden="true"/></a>{guides[lang].map(guide=><a href={guide.path} key={guide.id}>{guide.h1}</a>)}</nav>}
