import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ArrowDown, ArrowUpRight, ArrowRight, Menu, X, Plus, Pause, Play, Check, Globe2, Mic, Download, MessageCircle, Instagram, Linkedin, Facebook } from 'lucide-react';
import { copy, type Language } from './translations';
import ChartScroll from './ChartScroll';
import CookieConsent from './CookieConsent';
import {homeSchema} from './seo';
import {ResourcesTeaser,ResourceFooterLinks} from './ResourceLinks';
import {manageVideoPlayback, type PlaybackState} from './video-playback';
import './resources.css';

const APP_URL='https://app.periovox.ai/';
const WA='https://wa.me/34690957910';
const anchors=['how','platform','gbt','integrations'];
function Label({children}:{children:ReactNode}) {return <p className="eyebrow"><span/>{children}</p>}
function Reveal({children,className=''}:{children:ReactNode;className?:string}) {
 const ref=useRef<HTMLDivElement>(null);const [hidden,setHidden]=useState(false);const reduce=useReducedMotion();
 useEffect(()=>{const el=ref.current;if(!el || reduce)return;if(el.getBoundingClientRect().top>window.innerHeight)setHidden(true);const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setHidden(false);observer.disconnect()}},{threshold:.08});observer.observe(el);return()=>observer.disconnect()},[reduce]);
 return <div ref={ref} className={`reveal ${hidden?'waiting':''} ${className}`}>{children}</div>
}
function Brand({transparent=false}:{transparent?:boolean}){return <a href="#top" className="brand" aria-label="PerioVox"><img src={transparent?"/media/logo-periovox-transparent.svg":"/media/logo-periovox.png"} width="598" height="184" alt="PerioVox"/></a>}
function SocialLinks(){
 const links=[
  {name:'Instagram',href:'https://www.instagram.com/periovox.ai',Icon:Instagram},
  {name:'LinkedIn',href:'https://www.linkedin.com/company/periovox-ai/',Icon:Linkedin},
  {name:'Facebook',href:'https://facebook.com/periovox',Icon:Facebook}
 ];
 return <div className="footer-socials">{links.map(({name,href,Icon})=><a key={name} href={href} target="_blank" rel="noreferrer"><Icon size={20} strokeWidth={1.7} aria-hidden="true"/><span>{name}</span></a>)}</div>
}
function CTA({children,className='',href=APP_URL}:{children:ReactNode;className?:string;href?:string}){return <a className={`button ${className}`} href={href} data-conversion={href===APP_URL?'start_free':undefined}>{children}<ArrowUpRight size={19} strokeWidth={1.7}/></a>}
function HowSteps({lang}:{lang:Language}) {
 const icons=[
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 27 2-13.5q.5-3.5 3-2l6 3.5h12"/><path d="m5.8 22 1.8.3m-1-5.1 1.8.3M18 13v4m3-4v4m3-4v4"/></svg>,
  <Mic size={29} strokeWidth={1.5} aria-hidden="true"/>,
  <Check size={30} strokeWidth={1.5} aria-hidden="true"/>
 ];
 return <div className="steps">{copy[lang].steps.map(([n,title,text],i)=><Reveal className="step" key={n}>
  <div className="step-card">
   <div className="step-meta"><span className="step-n">{n}</span><span className="step-icon" aria-hidden="true">{icons[i]}</span></div>
   <h3>{title}</h3><p>{text}</p>
  </div>
 </Reveal>)}</div>
}
function LoopVideo({src,poster,lang,className='',scale}:{src:string;poster:string;lang:Language;className?:string;scale?:MotionValue<number>}) {
 const ref=useRef<HTMLVideoElement>(null);const inView=useRef(false);const controller=useRef<ReturnType<typeof manageVideoPlayback>|null>(null);const isHero=className==='hero-background-video';const [near,setNear]=useState(isHero);const [paused,setPaused]=useState(false);const [userStarted,setUserStarted]=useState(false);const [playback,setPlayback]=useState<PlaybackState>('starting');const reduce=useReducedMotion();const shouldPause=paused || (!!reduce && !userStarted);const pauseRequested=useRef(shouldPause);pauseRequested.current=shouldPause;const showPlay=shouldPause || playback!=='playing';
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const bounds=(el.parentElement ?? el).getBoundingClientRect();inView.current=bounds.bottom>-150&&bounds.top<window.innerHeight+150;setNear(inView.current);
  const playbackController=manageVideoPlayback(el,{canPlay:()=>!pauseRequested.current&&inView.current&&!document.hidden,onState:setPlayback});controller.current=playbackController;
  const sync=()=>playbackController.sync();
  const observer=new IntersectionObserver(([entry])=>{inView.current=entry.isIntersecting;setNear(entry.isIntersecting);sync()},{rootMargin:'150px'});
  observer.observe(el.parentElement ?? el);
  document.addEventListener('visibilitychange',sync);window.addEventListener('pageshow',sync);
  return()=>{observer.disconnect();playbackController.dispose();controller.current=null;document.removeEventListener('visibilitychange',sync);window.removeEventListener('pageshow',sync)};
 },[src]);
 useEffect(()=>{controller.current?.sync()},[shouldPause]);
 return <><motion.video ref={ref} style={scale&&!reduce?{scale}:undefined} className={`${className}${playback==='error'?' video-error':''}`} src={src} poster={poster} preload={isHero?'auto':'none'} muted loop playsInline autoPlay={near&&!shouldPause} aria-hidden="true"/><button type="button" className="media-control" onClick={()=>{if(showPlay){pauseRequested.current=false;setPaused(false);setUserStarted(true);controller.current?.resume()}else{pauseRequested.current=true;setPaused(true);controller.current?.sync()}}} aria-label={showPlay?copy[lang].play:copy[lang].pause}>{showPlay?<Play size={15}/>:<Pause size={15}/>}</button></>
}
function Probe({lang}:{lang:Language}){
 const t=copy[lang];const [paused,setPaused]=useState(false);const reduce=useReducedMotion();
 const ref=useRef<HTMLElement>(null);const {scrollYProgress}=useScroll({target:ref,offset:['start end','end start']});
 const scale=useTransform(scrollYProgress,[0,.5,1],[.93,1,.96]);
 return <section className="probe-section" id="probe" ref={ref}>
  <div className="section-wrap"><Reveal><Label>{t.probeLabel}</Label><h2>{t.probeTitle[0]}{' '}<br/><span>{t.probeTitle[1]}</span></h2></Reveal></div>
  <motion.div className={'probe-stage'+(paused||reduce?' stopped':'')} style={{scale:reduce?1:scale}}>
   <div className="probe-shadow"/><img className="floating-probe" src="/media/sonda-original.webp" width="1646" height="464" alt={lang==='es'?'Sonda periodontal convencional de acero inoxidable':'Conventional stainless steel periodontal probe'} loading="lazy" decoding="async"/>
   {!reduce&&<button className="probe-control" onClick={()=>setPaused(!paused)} aria-pressed={paused} aria-label={paused?t.probePlay:t.probePause}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>}
  </motion.div>
  <div className="probe-bottom section-wrap"><p>{t.probeText}</p><div><strong>0<span>%</span></strong><small>{t.probeFoot}</small></div></div>
 </section>
}
function Platform({lang}:{lang:Language}){
 const t=copy[lang];const [active,setActive]=useState('evolution');const tabRefs=useRef<(HTMLButtonElement|null)[]>([]);
 useEffect(()=>{const show=()=>setActive('reports');window.addEventListener('periovox:show-reports',show);return()=>window.removeEventListener('periovox:show-reports',show)},[]);
 return <section className="platform section-wrap" id="platform"><Reveal><Label>{t.platformLabel}</Label><div className="section-intro"><h2>{t.platformTitle}</h2><p>{t.platformText}</p></div></Reveal>
  <div className="tool-tabs" role="tablist" aria-label={t.platformTitle}>{t.tools.map((tool,i)=><button ref={el=>{tabRefs.current[i]=el}} type="button" id={`tab-${tool.id}`} role="tab" aria-selected={active===tool.id} aria-controls={`panel-${tool.id}`} tabIndex={active===tool.id?0:-1} className={active===tool.id?'active':''} key={tool.id} onClick={()=>setActive(tool.id)} onKeyDown={event=>{const count=t.tools.length;let next=i;if(event.key==='ArrowRight')next=(i+1)%count;else if(event.key==='ArrowLeft')next=(i+count-1)%count;else if(event.key==='Home')next=0;else if(event.key==='End')next=count-1;else return;event.preventDefault();setActive(t.tools[next].id);tabRefs.current[next]?.focus()}}><span>{String(i+1).padStart(2,'0')}</span>{tool.name}<ArrowUpRight size={18}/></button>)}</div>
  {t.tools.map((tool,i)=><div className={`tool-panel tool-${tool.id}`} id={`panel-${tool.id}`} role="tabpanel" aria-labelledby={`tab-${tool.id}`} hidden={active!==tool.id} tabIndex={0} key={tool.id}>
   {tool.id==='comparisons'?<div className="comparison-images">{[
    {src:tool.image,alt:tool.alt,width:2336,height:1110},
    {src:'/media/comparativa-4.webp',alt:t.comparisonTrendAlt,width:2328,height:812}
   ].map((image,i)=><figure key={image.src}><a href={image.src} target="_blank" rel="noreferrer" aria-label={`${t.comparisonEnlarge}: ${t.comparisonCaptions[i]}`}><img {...image} loading="lazy" decoding="async"/></a><figcaption><span>{t.comparisonCaptions[i]}</span><a href={image.src} target="_blank" rel="noreferrer">{t.comparisonEnlarge}<ArrowUpRight size={14}/></a></figcaption></figure>)}</div>:tool.id==='reports'?<div className="report-images"><div className="qr-frame"><img className="qr-image" src="/media/informe-qr.webp" width="890" height="1322" alt={lang==='es'?'Ejemplo de QR para acceder al informe del paciente':'Example QR access to a patient report'} loading="lazy" decoding="async"/></div><img src={tool.image} alt={tool.alt} loading="lazy" decoding="async" width="953" height="1651"/></div>:<div className="tool-image"><img src={tool.image} alt={tool.alt} loading="lazy" decoding="async" width={tool.id==='evolution'?2372:2200} height={tool.id==='evolution'?1240:tool.id==='lang'?1062:1240}/></div>}
   <div className="tool-copy"><span className="tool-no">{String(i+1).padStart(2,'0')} / {String(t.tools.length).padStart(2,'0')}</span><h3>{tool.title}</h3><p>{tool.text}</p><span className="tool-detail">{tool.detail}</span>{tool.id==='reports'&&<a className="text-link" href="/media/report-2.jpg" target="_blank" rel="noreferrer">{lang==='es'?'Ver otro ejemplo de informe':'View another report example'}<ArrowUpRight size={16}/></a>}</div>
  </div>)}
 </section>
}
export default function App({lang}:{lang:Language}){
 const t=copy[lang];const [menu,setMenu]=useState(false);const [scrolled,setScrolled]=useState(false);const [cookieSettings,setCookieSettings]=useState(false);const [example,setExample]=useState(0);const reduce=useReducedMotion();
 const heroRef=useRef<HTMLElement>(null);const {scrollYProgress}=useScroll({target:heroRef,offset:['start start','end start']});const heroY=useTransform(scrollYProgress,[0,1],[0,90]);const heroScale=useTransform(scrollYProgress,[0,1],[1,1.08]);
 useEffect(()=>{document.documentElement.lang=lang;const update=()=>setScrolled(window.scrollY>window.innerHeight*.65);update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update)},[lang]);
 useEffect(()=>{if(!menu)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[menu]);
 const schema=homeSchema(lang);
 return <div id="top">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  <a className="skip-link" href="#main">{lang==='es'?'Saltar al contenido':'Skip to content'}</a>
  <header className={`site-header ${scrolled?'light':''} ${menu?'menu-open':''}`}><div className="header-inner"><Brand transparent/><nav className="desktop-nav" aria-label={lang==='es'?'Navegación principal':'Main navigation'}>{t.nav.map((item,i)=><a key={item} href={`#${anchors[i]}`}>{item}</a>)}<a href={lang==='es'?'/es/journal/':'/journal/'} className="journal-nav-link">Journal</a></nav><div className="header-actions"><div className="language-switch"><a href="/es/" lang="es" hrefLang="es" aria-current={lang==='es'?'page':undefined}>ES</a><i>/</i><a href="/" lang="en" hrefLang="en" aria-current={lang==='en'?'page':undefined}>EN</a></div><a className="login" href={APP_URL}>{t.login}<ArrowUpRight size={15}/></a><button className="menu-button" aria-label={t.menu} aria-expanded={menu} aria-controls="mobile-nav" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></div>
   {menu&&<nav id="mobile-nav" className="mobile-nav" aria-label={t.menu}>{t.nav.map((item,i)=><a href={`#${anchors[i]}`} key={item} onClick={()=>setMenu(false)}>{item}<ArrowUpRight/></a>)}<a href={lang==='es'?'/es/journal/':'/journal/'} onClick={()=>setMenu(false)}>Journal<ArrowUpRight/></a><CTA>{t.start}</CTA></nav>}
  </header>
  <main id="main">
   <section className="hero" ref={heroRef} aria-labelledby="hero-title"><img className="hero-poster" src="/media/hero-poster.jpg" width="1672" height="941" alt="" aria-hidden="true" fetchPriority="high"/><LoopVideo src="/media/hero-loop.mp4" poster="/media/hero-poster.jpg" lang={lang} className="hero-background-video" scale={heroScale}/><div className="hero-shade"/>
    <motion.div className="hero-copy" style={{y:reduce?0:heroY}}><Label>{t.heroLabel}</Label><h1 id="hero-title">{t.hero[0]}{' '}<br/>{t.hero[1]}</h1><p className="hero-free">{t.forever}</p><p className="hero-description">{t.heroText}</p><CTA className="button-white">{t.start}</CTA></motion.div>
    <div className="hero-bottom"><a href="#how" className="scroll-link"><span className="scroll-ring"><ArrowDown size={18}/></span>{t.discover}</a><span className="hero-footnote"><i/> {t.noHardware}<span> / </span>{t.browser}</span><span className="hero-edition">PERIOVOX <span>—</span> VOICE FIRST</span></div>
   </section>
   <span id="how-it-works" className="anchor-alias" aria-hidden="true"/><section className="intro section-wrap" id="how"><Reveal><Label>{t.introLabel}</Label><h2>{t.introTitle[0]}{' '}<br/><span>{t.introTitle[1]}</span></h2><div className="intro-summary"><span className="intro-line"/><p>{t.introText}</p></div></Reveal><HowSteps lang={lang}/></section>
   <span id="workflow" className="anchor-alias" aria-hidden="true"/><ChartScroll lang={lang}/>
   <span id="features" className="anchor-alias" aria-hidden="true"/><section className="voice section-wrap" id="voice"><Reveal className="voice-copy"><Label>{t.voiceLabel}</Label><h2>{t.voiceTitle}</h2><p>{t.voiceText}</p><small>{t.voiceNote}</small></Reveal><Reveal className="voice-demo"><div className="voice-demo-head"><Mic size={19}/><span>{lang==='es'?'Ejemplos de dictado':'Dictation examples'}</span><span>FDI</span></div><div className="waveform" aria-hidden="true">{Array.from({length:48},(_,i)=><i key={i} style={{height:`${8+Math.abs(Math.sin(i*.71))*36+Math.abs(Math.cos(i*.31))*18}px`,animationDelay:`${i*-.11}s`}}/>)}</div>{t.examples.map((text,i)=><button className={example===i?'selected':''} key={text} onClick={()=>setExample(i)}><span>0{i+1}</span><q>{text.replace(/[«»“”]/g,'')}</q><Check size={16}/></button>)}</Reveal></section>
   <span id="benefits" className="anchor-alias" aria-hidden="true"/><Probe lang={lang}/>
   <section className="global section-wrap" id="languages"><Reveal className="global-number"><span>97</span><Globe2 strokeWidth={.65} aria-hidden="true"/></Reveal><Reveal className="global-copy"><Label>{t.globalLabel}</Label><h2>{t.globalTitle[0]}{' '}<br/><span>{t.globalTitle[1]}</span></h2><p>{t.globalText}</p><small>{t.interface}</small><div className="language-tags"><span>Español</span><span>English</span><span>Français</span><span>Deutsch</span><span>日本語</span><span>+92</span></div></Reveal></section>
   <Platform lang={lang}/>
   <section className="standards"><div className="section-wrap standards-inner"><Reveal><Label>{t.standardsLabel}</Label><h2>{t.standardsTitle}</h2><p>{t.standardsText}</p></Reveal><div className="standards-logos"><img src="/media/ada.jpg" alt="American Dental Association (ADA)" width="250" height="250" loading="lazy" decoding="async"/><span>/</span><img src="/media/fdi.webp" alt="FDI World Dental Federation" width="261" height="127" loading="lazy" decoding="async"/></div></div></section>
   <section className="patient" id="patient" aria-labelledby="patient-title"><img className="patient-poster" src="/media/conversation-loop-poster.jpg" width="1920" height="1080" alt="" aria-hidden="true" loading="lazy" decoding="async"/><LoopVideo src="/media/conversation-loop.mp4" poster="/media/conversation-loop-poster.jpg" lang={lang}/><div className="patient-shade"/><Reveal className="patient-copy"><Label>{t.patientLabel}</Label><h2 id="patient-title">{t.patientTitle[0]}{' '}<br/>{t.patientTitle[1]}</h2><p>{t.patientText}</p><a className="text-link" href="#platform" onClick={()=>{window.dispatchEvent(new Event('periovox:show-reports'))}}>{t.patientLink}<ArrowUpRight size={18}/></a></Reveal></section>
   <section className="export section-wrap" id="export"><Reveal><Label>{t.exportLabel}</Label><h2>{t.exportTitle[0]}{' '}<br/><span>{t.exportTitle[1]}</span></h2><p>{t.exportText}</p><small>{t.exportNote}</small></Reveal><Reveal className="csv-visual"><div className="csv-top"><Download size={18}/><span>periodontogram.csv</span><span>CSV</span></div><div className="csv-table" aria-label={lang==='es'?'Ejemplo ilustrativo de datos estructurados':'Illustrative example of structured data'}><div><span>TOOTH</span><span>SITE</span><span>PD</span><span>BOP</span></div>{[['18','Distal','4','—'],['18','Mid','3','—'],['18','Mesial','3','—'],['17','Distal','3','●'],['17','Mid','2','●'],['17','Mesial','1','●']].map((row,i)=><div key={i}>{row.map((v,j)=><span key={j}>{v}</span>)}</div>)}</div><span className="csv-caption">{lang==='es'?'Ejemplo de estructura de exportación':'Example export structure'}</span></Reveal></section>
   <section className="ems section-wrap" id="gbt"><Reveal className="ems-copy"><Label>{t.emsLabel}</Label><h2>{t.emsTitle}</h2><p>{t.emsText}</p><span className="market-note"><i/>{t.markets}</span><a href="https://www.ems-dental.com/en-us/discover-gbt" className="text-link" target="_blank" rel="noreferrer">{t.gbtLink}<ArrowUpRight size={18}/></a></Reveal><Reveal className="ems-brand"><div className="ems-logowindow"><img src="/media/ems.webp" alt="EMS" width="1350" height="1080" loading="lazy" decoding="async"/></div><div className="ems-bottom"><img src="/media/gbt.webp" alt="Guided Biofilm Therapy — GBT" width="447" height="447" loading="lazy" decoding="async"/><p>GUIDED<br/>BIOFILM<br/><strong>THERAPY</strong></p></div></Reveal></section>
   <span id="open-api" className="anchor-alias" aria-hidden="true"/><section className="integration" id="integrations"><div className="section-wrap"><Reveal><Label>{t.integrationLabel}</Label><div className="integration-grid"><h2>{t.integrationTitle[0]}{' '}<br/><span>{t.integrationTitle[1]}</span></h2><div><p>{t.integrationText}</p><CTA className="button-white" href={`mailto:info@periovox.ai?subject=${encodeURIComponent(lang==='es'?'Integración PerioVox':'PerioVox integration')}`}>{t.integrationCta}</CTA></div></div><div className="orca-row"><div className="orca-heading"><span>{t.orcaLabel}</span><img className="orca-logo" src="/media/logo-orca.png" width="252" height="120" alt="Orca" loading="lazy" decoding="async"/><h3>{t.orcaTitle}</h3></div><p>{t.orca}</p><a className="text-link" href="https://orca.clinic/" target="_blank" rel="noreferrer">{t.orcaLink}<ArrowUpRight size={17}/></a></div></Reveal></div></section>
   <ResourcesTeaser lang={lang}/>
   <section className="faq section-wrap" id="faq"><Reveal className="faq-heading"><Label>{t.faqLabel}</Label><h2>{t.faqTitle}</h2><a className="text-link" href={WA} target="_blank" rel="noreferrer">{t.contact}<ArrowUpRight size={17}/></a></Reveal><div className="faq-items">{t.faq.map(([question,answer],i)=><details key={question}><summary><span className="faq-n">{String(i+1).padStart(2,'0')}</span><h3>{question}</h3><Plus size={20}/></summary><p>{answer}</p></details>)}</div></section>
   <section className="final"><div className="final-orb" aria-hidden="true"/><Reveal><Label>{t.finalLabel}</Label><h2>{t.finalTitle[0]}{' '}<br/>{t.finalTitle[1]}</h2><p className="final-free">{t.forever}</p><p>{t.finalText}</p><CTA>{t.start}</CTA></Reveal></section>
  </main>
  <footer className="footer section-wrap"><div className="footer-top"><div><Brand/><p>{t.footerLine}</p></div><div className="footer-contact" id="contact"><h2>{t.contact}</h2><p>{t.contactText}</p><a href="mailto:info@periovox.ai">info@periovox.ai<ArrowUpRight size={18}/></a><a href={WA} target="_blank" rel="noreferrer">WhatsApp<ArrowUpRight size={18}/></a></div><div className="footer-links"><a href={`/terms-of-use.html${lang==='es'?'#es':'#en'}`}>{t.terms}</a><a href={`/privacy-notice.html${lang==='es'?'#es':'#en'}`}>{t.privacy}</a><a href={`/cookie-policy.html${lang==='es'?'#es':'#en'}`}>{t.cookies}</a><button onClick={()=>setCookieSettings(true)}>{t.cookieSettings}</button></div></div><ResourceFooterLinks lang={lang}/><div className="footer-bottom"><span>© {new Date().getFullYear()} PerioVox · Novik Nexus</span><SocialLinks/></div><p className="disclaimer">{t.disclaimer}</p></footer>
  <a className="whatsapp" href={WA} target="_blank" rel="noreferrer" aria-label={t.whatsapp}><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 .9A14.7 14.7 0 0 0 3.3 23l-2 7.3 7.5-2A14.7 14.7 0 1 0 16 .9m0 26.8c-2.1 0-4.2-.6-6-1.6l-.4-.2-4.5 1.2 1.2-4.4-.3-.5A12.1 12.1 0 1 1 16 27.7m6.6-9c-.4-.2-2.2-1.1-2.6-1.2-.3-.1-.6-.2-.8.2l-1.2 1.5c-.2.3-.4.3-.8.1-1.8-.9-3.3-2.2-4.3-3.9-.3-.4.3-.7.9-1.5.1-.2.1-.5 0-.7l-1.2-2.9c-.3-.7-.7-.6-1-.6h-.8c-.3 0-.7.1-1 .5-2.5 2.7-.4 6 1.9 8.5 2 2.1 4.6 3.7 7.5 4.4 1 .3 2 .2 2.7-.2.8-.4 2.2-1.3 2.5-2.5.2-1.2.2-2.1 0-2.3-.1-.1-.4-.2-.8-.4Z"/></svg></a>
  <CookieConsent lang={lang} settingsOpen={cookieSettings} closeSettings={()=>setCookieSettings(false)}/>
 </div>
}
