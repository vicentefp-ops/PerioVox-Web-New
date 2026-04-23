import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { UserMinus, Mic, Globe, Stethoscope, Users, Activity, Clock, FileWarning, Sparkles, BarChart3, Check, Facebook, Instagram, Linkedin, Cookie, X, Menu, FileSpreadsheet, MessageCircle, Code } from "lucide-react";
import { translations } from "./translations";

export default function App() {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const t = (path: string) => path.split('.').reduce((acc, part) => acc[part], translations[lang] as any);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cookieSettings, setCookieSettings] = useState({
    preferences: true,
    analytics: true,
    advertising: true,
  });

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowCookieBanner(true);
    } else if (consent === 'custom') {
      const settings = localStorage.getItem('cookie-settings');
      if (settings) {
        try {
          setCookieSettings(JSON.parse(settings));
        } catch (e) {}
      }
    } else if (consent === 'all') {
      setCookieSettings({ preferences: true, analytics: true, advertising: true });
    }
  }, []);

  const acceptAllCookies = () => {
    localStorage.setItem('cookie-consent', 'all');
    localStorage.setItem('cookie-settings', JSON.stringify({ preferences: true, analytics: true, advertising: true }));
    setCookieSettings({ preferences: true, analytics: true, advertising: true });
    setShowCookieBanner(false);
    setShowCookieModal(false);
  };

  const declineAllCookies = () => {
    localStorage.setItem('cookie-consent', 'necessary');
    localStorage.setItem('cookie-settings', JSON.stringify({ preferences: false, analytics: false, advertising: false }));
    setCookieSettings({ preferences: false, analytics: false, advertising: false });
    setShowCookieBanner(false);
    setShowCookieModal(false);
  };

  const savePreferences = () => {
    localStorage.setItem('cookie-consent', 'custom');
    localStorage.setItem('cookie-settings', JSON.stringify(cookieSettings));
    setShowCookieBanner(false);
    setShowCookieModal(false);
  };

  const toggleSetting = (key: keyof typeof cookieSettings) => {
    setCookieSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 h-20 bg-white border-b border-zinc-200">
        <nav className="flex items-center justify-between h-full max-w-7xl mx-auto" aria-label="Main Navigation">
          <div className="flex items-center h-full overflow-hidden -ml-6">
            <img src="/Logo Texto.png" alt="PerioVoxAI Logo" title="PerioVoxAI" className="h-[84.375%] w-auto object-contain" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-zinc-900 transition-colors">{t('nav.features')}</a>
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-zinc-900 transition-colors">{t('nav.workflow')}</a>
            <a href="#benefits" onClick={(e) => scrollToSection(e, 'benefits')} className="hover:text-zinc-900 transition-colors">{t('nav.benefits')}</a>
            <a href="#open-api" onClick={(e) => scrollToSection(e, 'open-api')} className="hover:text-zinc-900 transition-colors">{t('nav.openApi')}</a>
            <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="hover:text-zinc-900 transition-colors">{t('nav.contact')}</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors text-xs font-semibold tracking-wide"
              aria-label={lang === 'en' ? "Cambiar a Español" : "Switch to English"}
            >
              <span className={lang === 'en' ? 'text-zinc-900' : 'text-zinc-400'}>EN</span>
              <span className="text-zinc-300">/</span>
              <span className={lang === 'es' ? 'text-zinc-900' : 'text-zinc-400'}>ES</span>
            </button>
            <a href="https://app.periovox.ai" className="hidden md:block text-sm font-medium text-white bg-[#0A0A0A] px-4 py-2 rounded-full hover:bg-zinc-800 transition-colors">
              {t('nav.login')}
            </a>
            <button className="md:hidden p-2 text-zinc-500" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle Menu">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden">
          <nav className="flex flex-col gap-6 text-lg font-medium text-zinc-900" aria-label="Mobile Navigation">
            <a href="#features" onClick={(e) => { scrollToSection(e, 'features'); setIsMobileMenuOpen(false); }} className="border-b border-zinc-100 pb-4">{t('nav.features')}</a>
            <a href="#how-it-works" onClick={(e) => { scrollToSection(e, 'how-it-works'); setIsMobileMenuOpen(false); }} className="border-b border-zinc-100 pb-4">{t('nav.workflow')}</a>
            <a href="#benefits" onClick={(e) => { scrollToSection(e, 'benefits'); setIsMobileMenuOpen(false); }} className="border-b border-zinc-100 pb-4">{t('nav.benefits')}</a>
            <a href="#open-api" onClick={(e) => { scrollToSection(e, 'open-api'); setIsMobileMenuOpen(false); }} className="border-b border-zinc-100 pb-4">{t('nav.openApi')}</a>
            <a href="#contact" onClick={(e) => { scrollToSection(e, 'contact'); setIsMobileMenuOpen(false); }} className="border-b border-zinc-100 pb-4">{t('nav.contact')}</a>
            <a href="https://app.periovox.ai" className="text-center text-white bg-[#0A0A0A] px-4 py-3 rounded-full hover:bg-zinc-800 transition-colors mt-4">
              {t('nav.login')}
            </a>
          </nav>
        </div>
      )}

      <main>
        {/* Hero Section */}
      <section className="relative h-screen min-h-[700px] flex items-center justify-start overflow-hidden">
        <div className="absolute inset-0 z-0">
          <motion.img
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            src="/Higienista PerioVoxAI.png"
            alt="Clinical Environment"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-start text-left px-6 md:px-12 lg:px-24 max-w-7xl mx-auto mt-20 w-full">
          <div className="max-w-3xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8 leading-[1.1]"
            >
              <span className="text-white">{t('hero.title1')}</span><br />
              <span className="bg-gradient-to-r from-sky-400 to-sky-200 bg-clip-text text-transparent">{t('hero.title2')}</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-xl md:text-2xl text-zinc-300 font-light mb-12 max-w-2xl leading-relaxed"
            >
              {t('hero.subtitle')}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-4 items-center"
            >
              <a href="https://app.periovox.ai" className="bg-sky-500 text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-sky-600 transition-colors duration-300 shadow-[0_0_40px_rgba(14,165,233,0.4)]">
                {t('hero.cta')}
              </a>
            </motion.div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="absolute bottom-12 left-0 right-0 text-center"
        >
          <p className="text-sm text-zinc-400 font-light tracking-wide">
            {t('hero.footer')}
          </p>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="pt-12 md:pt-16 pb-8 md:pb-10 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-zinc-200 text-zinc-500 text-xs font-semibold tracking-widest uppercase mb-8">
              {t('problem.tag')}
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6 text-sky-900 leading-[1.1]">
              {t('problem.title')}
            </h2>
            <p className="text-xl text-zinc-500 font-light leading-relaxed">
              {t('problem.desc')}
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <img 
              src="/Foto higienista haciendo sondaje periodontal.jpg" 
              alt="Traditional charting" 
              className="w-full h-[300px] md:h-[400px] object-cover rounded-[2rem] shadow-lg"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-1 bg-gradient-to-br from-white to-sky-50/30 border border-sky-100 rounded-[2.5rem] p-10 md:p-12 shadow-sm hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-500 flex flex-col justify-center relative overflow-hidden group"
          >
            {/* Decorative background element */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-100/50 rounded-full blur-3xl group-hover:bg-sky-200/50 transition-colors duration-700" />
            
            <div className="relative z-10">
              <div className="mb-8 inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 border border-sky-100">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V12C14.017 12.5523 13.5693 13 13.017 13H11.017C10.4647 13 10.017 12.5523 10.017 12V9C10.017 7.34315 11.3601 6 13.017 6H19.017C20.6738 6 22.017 7.34315 22.017 9V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM3.017 21L3.017 18C3.017 16.8954 3.91243 16 5.017 16H8.017C8.56928 16 9.017 15.5523 9.017 15V9C9.017 8.44772 8.56928 8 8.017 8H4.017C3.46472 8 3.017 8.44772 3.017 9V12C3.017 12.5523 2.56928 13 2.017 13H0.017C-0.535282 13 -1.017 12.5523 -1.017 12V9C-1.017 7.34315 0.326142 6 2.017 6H8.017C9.67386 6 11.017 7.34315 11.017 9V15C11.017 18.3137 8.33071 21 5.017 21H3.017Z" />
                </svg>
              </div>
              <h3 className="text-3xl md:text-4xl font-medium text-sky-900 mb-8 leading-[1.15] tracking-tight">
                {t('problem.cardTitle')}
              </h3>
              <div className="w-12 h-1 bg-sky-500/20 rounded-full mb-8" />
              <p className="text-lg text-zinc-500 font-light leading-relaxed">
                {t('problem.cardDesc')}
              </p>
            </div>
          </motion.div>
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
            {[
              { title: t('problem.features.0.title'), desc: t('problem.features.0.desc'), icon: Users },
              { title: t('problem.features.1.title'), desc: t('problem.features.1.desc'), icon: Activity },
              { title: t('problem.features.2.title'), desc: t('problem.features.2.desc'), icon: Clock },
              { title: t('problem.features.3.title'), desc: t('problem.features.3.desc'), icon: FileWarning }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 + (i * 0.1), ease: [0.16, 1, 0.3, 1] }}
                className="bg-white border border-zinc-100 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-6">
                  <item.icon className="w-6 h-6 text-sky-500" strokeWidth={1.5} />
                </div>
                <h4 className="text-xl font-medium text-sky-900 mb-3">{item.title}</h4>
                <p className="text-zinc-500 font-light leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Interaction Section */}
      <section id="features" className="pb-10 md:pb-12 pt-10 md:pt-12 px-6 max-w-5xl mx-auto text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <motion.div 
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-600 text-sm font-medium mb-6 border border-sky-100 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            {t('voice.tag')}
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
            {t('voice.title')}
          </h2>
          <p className="text-lg md:text-xl text-zinc-500 font-light leading-relaxed mb-6 max-w-2xl">
            {t('voice.desc')}
          </p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col items-center"
          >
            <motion.div 
              whileHover={{ scale: 1.02, rotate: -1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="bg-zinc-50 p-8 md:p-12 rounded-3xl w-full max-w-3xl flex flex-col items-center justify-center shadow-inner mb-6"
            >
              <motion.img 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                src="/Start Voice input 2.png" 
                alt="Start Voice Input" 
                className="w-48 md:w-64 drop-shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <p className="text-xl md:text-2xl font-medium text-sky-900 max-w-2xl">
              {t('voice.buttonText')}
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* The Approach Section */}
      <section id="how-it-works" className="pt-10 md:pt-12 pb-12 md:pb-16 px-6 bg-gradient-to-b from-[#FAFAFA] to-sky-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-sky-200 text-sky-600 text-xs font-semibold tracking-widest uppercase mb-8 bg-white shadow-sm">
                {t('approach.tag')}
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6 text-sky-900 leading-[1.1]">
                {t('approach.title')}
              </h2>
              <p className="text-xl text-zinc-500 font-light leading-relaxed">
                {t('approach.desc')}
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: t('approach.steps.0.title'), desc: t('approach.steps.0.desc'), icon: Mic },
              { title: t('approach.steps.1.title'), desc: t('approach.steps.1.desc'), icon: Sparkles },
              { title: t('approach.steps.2.title'), desc: t('approach.steps.2.desc'), icon: BarChart3 }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="group bg-white border border-zinc-100 rounded-[2.5rem] p-10 md:p-12 shadow-sm hover:shadow-2xl hover:shadow-sky-500/5 transition-all duration-500 relative overflow-hidden flex flex-col min-h-[420px]"
              >
                {/* Large Background Number */}
                <div className="absolute top-6 right-8 text-[10rem] font-bold text-sky-500/[0.08] select-none pointer-events-none group-hover:text-sky-500/[0.12] transition-all duration-700 font-sans italic leading-none">
                  {i + 1}
                </div>

                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-10 inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-sky-50 to-white text-sky-500 border border-sky-100 shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <item.icon className="w-10 h-10" strokeWidth={1.2} />
                  </div>
                  
                  <h3 className="text-3xl font-medium text-sky-900 mb-6 leading-tight group-hover:text-sky-600 transition-colors duration-300">
                    {item.title}
                  </h3>
                  
                  <p className="text-lg text-zinc-500 font-light leading-relaxed">
                    {item.desc}
                  </p>
                  
                  {/* Step indicator dot */}
                  <div className="mt-auto pt-10 flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-sky-500' : i === 1 ? 'bg-sky-400' : 'bg-sky-300'} shadow-lg shadow-sky-500/20`} />
                    <div className="h-px flex-1 bg-zinc-100" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Periodontal Probe 2.0 Section */}
      <section className="py-10 md:py-12 px-6 bg-white border-t border-zinc-100">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <img 
              src="/Perio Probe.png" 
              alt="Periodontal Probe 2.0" 
              className="w-full h-auto max-w-3xl mx-auto"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-sky-200 text-sky-600 text-xs font-semibold tracking-widest uppercase mb-8 bg-sky-50 shadow-sm">
              {t('probe.tag')}
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6 text-sky-900 leading-[1.1]">
              {t('probe.title')}
            </h2>
            <p className="text-xl md:text-2xl text-zinc-500 font-light leading-relaxed mb-4 max-w-3xl mx-auto">
              {t('probe.desc')}
            </p>
            <p className="text-lg md:text-xl text-zinc-400 font-light leading-relaxed max-w-2xl mx-auto">
              {t('probe.subdesc')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Natural Conversation Section */}
      <section className="py-12 md:py-16 px-6 bg-white border-t border-zinc-100">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-sky-200 text-sky-600 text-xs font-semibold tracking-widest uppercase mb-8 bg-sky-50/50">
              {t('natural.tag')}
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900 leading-[1.1]">
              {t('natural.title')}
            </h2>
            <p className="text-xl text-zinc-500 font-light leading-relaxed mb-10">
              {t('natural.desc')}
            </p>

            <div className="space-y-6 mb-10">
              {t('natural.list').map((item: string, i: number) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-sky-500" strokeWidth={2.5} />
                  </div>
                  <span className="text-zinc-700 text-lg font-light">{item}</span>
                </motion.div>
              ))}
            </div>

            <p className="text-lg text-zinc-600 font-medium">
              {t('natural.conclusion')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0A0F1C] rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex items-start gap-5 mb-10 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center flex-shrink-0 border border-sky-500/30">
                <Mic className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">{t('natural.examples.title')}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{t('natural.examples.desc')}</p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              {t('natural.examples.quotes').map((quote: string, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + (i * 0.1) }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm"
                >
                  <p className="text-sky-100 font-light leading-relaxed tracking-wide">
                    {quote}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Periodontogram Section */}
      <section id="workflow" className="py-12 md:py-16 px-6 bg-white border-y border-zinc-100 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900"
          >
            {t('periodontogram.title')}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl text-zinc-500 font-light max-w-2xl mx-auto"
          >
            {t('periodontogram.desc')}
          </motion.p>
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={{ y: -10, boxShadow: "0 30px 60px -15px rgba(14, 165, 233, 0.15)" }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-6xl mx-auto rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] bg-white relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/5 to-transparent pointer-events-none" />
          <img 
            src="/Pantallazo PerioVoxAI.png" 
            alt="Periodontogram Interface" 
            className="w-full h-auto relative z-10 border border-zinc-200 rounded-2xl"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </section>

      {/* AI-Powered Change Detection Section */}
      <section className="py-12 md:py-16 px-6 bg-sky-50/50 border-b border-sky-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex justify-center"
            >
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-zinc-100 flex flex-col items-center text-center">
                <Activity className="w-16 h-16 text-sky-500 mb-6" />
                <h3 className="text-2xl font-medium text-sky-900 mb-2">Automated Analysis</h3>
                <p className="text-zinc-500 font-light">Comparing visits in real-time</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
                {t('changeDetection.title')}
              </h2>
              <p className="text-xl text-zinc-500 font-light leading-relaxed">
                {t('changeDetection.desc')}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Language Support Section */}
      <section className="py-12 md:py-16 px-6 bg-white border-b border-zinc-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
                {t('language.title')}
              </h2>
              <p className="text-xl text-zinc-500 font-light leading-relaxed mb-8">
                {t('language.desc')}
              </p>
              <div className="flex flex-wrap gap-3">
                {t('language.langs').map((lang: string) => (
                  <span key={lang} className="px-4 py-2 bg-white border border-sky-100 rounded-full text-sm font-medium text-sky-700 shadow-sm">
                    {lang}
                  </span>
                ))}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-zinc-100 grid grid-cols-2 gap-4">
                <div className="col-span-2 text-center mb-4">
                  <Globe className="w-12 h-12 text-sky-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-medium text-sky-900">40+ {t('language.dictation')}</h3>
                </div>
                <div className="bg-sky-50 p-4 rounded-2xl text-center">
                  <span className="block text-3xl mb-1">🇬🇧</span>
                  <span className="block text-xl font-bold text-sky-900">EN</span>
                  <span className="text-xs text-sky-600 font-semibold uppercase">{t('language.interface')}</span>
                </div>
                <div className="bg-sky-50 p-4 rounded-2xl text-center">
                  <span className="block text-3xl mb-1">🇪🇸</span>
                  <span className="block text-xl font-bold text-sky-900">ES</span>
                  <span className="text-xs text-sky-600 font-semibold uppercase">{t('language.interface')}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Lang Diagram Section */}
      <section className="py-12 md:py-16 px-6 max-w-[85rem] mx-auto">
        <div className="grid md:grid-cols-12 gap-12 lg:gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-7 lg:col-span-8"
          >
            <img 
              src="/Lang.png" 
              alt="Lang Diagram" 
              className="w-full rounded-2xl border border-zinc-200 shadow-xl shadow-sky-900/5"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-5 lg:col-span-4"
          >
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
              {t('langDiagram.title')}
            </h2>
            <p className="text-xl text-zinc-500 font-light leading-relaxed">
              {t('langDiagram.desc')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* IDRA Section */}
      <section className="py-12 md:py-16 px-6 max-w-[85rem] mx-auto">
        <div className="grid md:grid-cols-12 gap-12 lg:gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="order-2 md:order-1 md:col-span-5 lg:col-span-4"
          >
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
              {t('idra.title')}
            </h2>
            <p className="text-xl text-zinc-500 font-light leading-relaxed">
              {t('idra.desc')}
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="order-1 md:order-2 md:col-span-7 lg:col-span-8"
          >
            <img 
              src="/IDRA.png" 
              alt="IDRA Index" 
              className="w-full rounded-2xl border border-zinc-200 shadow-xl shadow-sky-900/5"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </section>

      {/* AI-Generated Patient Reports Section */}
      <section className="py-12 md:py-16 px-6 max-w-[85rem] mx-auto bg-sky-50/30 rounded-3xl my-12">
        <div className="grid md:grid-cols-12 gap-12 lg:gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-5 lg:col-span-4"
          >
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
              {t('patientReports.title')}
            </h2>
            <p className="text-xl text-zinc-500 font-light leading-relaxed">
              {t('patientReports.desc')}
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-7 lg:col-span-8 grid grid-cols-3 gap-4"
          >
            <img src="/QRPatient.png" alt="Patient QR Code" className="rounded-2xl border border-zinc-200 shadow-xl" referrerPolicy="no-referrer" />
            <img src="/InfoPatient1.jpg" alt="Patient Info 1" className="rounded-2xl border border-zinc-200 shadow-xl" referrerPolicy="no-referrer" />
            <img src="/InfoPatient2.jpg" alt="Patient Info 2" className="rounded-2xl border border-zinc-200 shadow-xl" referrerPolicy="no-referrer" />
          </motion.div>
        </div>
      </section>

      {/* Nomenclature Section */}
      <section className="py-10 md:py-16 px-6 bg-white border-y border-zinc-100">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl md:text-4xl font-medium tracking-tight mb-6 text-sky-900"
          >
            {t('nomenclature.title')}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-zinc-500 font-light mb-10"
          >
            {t('nomenclature.desc')}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center items-center gap-16 md:gap-32 opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
          >
            <img 
              src="/ADA.jpg" 
              alt="ADA Logo" 
              className="h-32 md:h-40 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <img 
              src="/FDI.png" 
              alt="FDI Logo" 
              className="h-16 md:h-20 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </section>

      {/* CSV Export Section */}
      <section className="py-20 px-6 bg-[#0A0F1C] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-sky-500/30 text-sky-400 text-xs font-semibold tracking-widest uppercase mb-8 bg-sky-500/10">
              {t('csvExport.tag')}
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-8 text-white leading-[1.1]">
              {t('csvExport.title')}
            </h2>
            <p className="text-xl text-zinc-400 font-light leading-relaxed mb-10">
              {t('csvExport.desc')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="relative z-10 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-12 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-between mb-12">
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
                <div className="px-3 py-1 rounded-md bg-white/10 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  export_data.csv
                </div>
              </div>
              
              <div className="space-y-4 font-mono text-xs md:text-sm">
                <div className="grid grid-cols-4 gap-4 pb-4 border-b border-white/10 text-sky-400">
                  <span>Tooth</span>
                  <span>Site</span>
                  <span>Depth</span>
                  <span>BOP</span>
                </div>
                {[
                  { t: "18", s: "Distal", d: "3", b: "Yes" },
                  { t: "18", s: "Mid", d: "2", b: "No" },
                  { t: "18", s: "Mesial", d: "3", b: "No" },
                  { t: "17", s: "Distal", d: "4", b: "Yes" },
                ].map((row, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (i * 0.1) }}
                    className="grid grid-cols-4 gap-4 text-zinc-500"
                  >
                    <span>{row.t}</span>
                    <span>{row.s}</span>
                    <span>{row.d}</span>
                    <span className={row.b === 'Yes' ? 'text-red-400/70' : ''}>{row.b}</span>
                  </motion.div>
                ))}
                <div className="pt-4 text-zinc-600 italic">... +248 rows</div>
              </div>

              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-sky-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-sky-500/40 transform rotate-12">
                <FileSpreadsheet className="w-12 h-12 text-white" strokeWidth={1.5} />
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-sky-500/20 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />
          </motion.div>
        </div>
      </section>

      {/* Core Benefits Section */}
      <section id="benefits" className="py-6 md:py-10 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8">
          {[
            { title: t('benefits.list.0.title'), desc: t('benefits.list.0.desc'), icon: UserMinus },
            { title: t('benefits.list.1.title'), desc: t('benefits.list.1.desc'), icon: Mic },
            { title: t('benefits.list.2.title'), desc: t('benefits.list.2.desc'), icon: Globe },
            { title: t('benefits.list.3.title'), desc: t('benefits.list.3.desc'), icon: Stethoscope }
          ].map((benefit, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }}
              className="border-t border-zinc-200 pt-6 flex flex-col items-center text-center group"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-20 h-20 rounded-3xl bg-sky-50 flex items-center justify-center mb-6 border border-sky-100/50 shadow-sm transition-colors group-hover:bg-sky-100"
              >
                <benefit.icon className="w-10 h-10 text-sky-500" strokeWidth={1.5} />
              </motion.div>
              <h3 className="text-2xl font-medium text-sky-900 mb-4">{benefit.title}</h3>
              <p className="text-lg text-zinc-500 font-light leading-relaxed">{benefit.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Built for Integration Section */}
      <section id="open-api" className="py-12 md:py-16 px-6 bg-white border-b border-zinc-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mb-8">
                <Code className="w-8 h-8 text-sky-600" />
              </div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-sky-900">
                {t('openApi.title')}
              </h2>
              <p className="text-xl text-zinc-500 font-light leading-relaxed">
                {t('openApi.desc')}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex justify-center"
            >
              <div className="bg-zinc-900 p-8 rounded-[2rem] shadow-2xl border border-zinc-800 w-full max-w-md">
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <pre className="text-sky-400 font-mono text-sm overflow-x-auto">
                  <code>{`{
  "status": "connected",
  "api": "periovox-v1",
  "features": [
    "periodontal-analysis",
    "charting-sync"
  ]
}`}</code>
                </pre>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-6 md:py-10 px-6 bg-gradient-to-b from-white to-sky-50/50 border-t border-zinc-100">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-sm border border-sky-100/50 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-sky-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-sky-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
            
            <div className="relative z-10">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-sky-100"
              >
                <svg className="w-8 h-8 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </motion.div>
              
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-2 text-sky-900">
                {t('contact.title')}
              </h2>
              <p className="text-lg md:text-xl text-zinc-500 font-light mb-8 max-w-xl mx-auto leading-relaxed">
                {t('contact.desc')}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.a 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  href="mailto:info@periovox.ai" 
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-sky-500 text-white rounded-full text-lg font-medium shadow-md shadow-sky-500/20 hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-500/30 transition-all duration-300 group"
                >
                  <span>{t('contact.button')}</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </motion.a>

                <motion.a 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  href="https://wa.me/34690957910"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#25D366] text-white rounded-full text-lg font-medium shadow-md shadow-green-500/20 hover:bg-[#20ba5a] hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 group"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>{t('contact.whatsapp')}</span>
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Floating WhatsApp Button */}
      <motion.a
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ delay: 2 }}
        href="https://wa.me/34690957910"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl shadow-green-500/40 hover:bg-[#20ba5a] transition-colors group"
        title={t('contact.whatsappMsg')}
      >
        <MessageCircle className="w-7 h-7" />
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-white text-zinc-900 text-sm font-medium rounded-lg shadow-xl border border-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t('contact.whatsappMsg')}
        </span>
      </motion.a>

      {/* Final CTA */}
      <section className="relative py-12 md:py-20 px-6 text-center text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/Imagen de sondaje periodontal.jpg"
            alt="Periodontal probing"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-[2px]" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto relative z-10"
        >
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight mb-8">
            {t('cta.title')}
          </h2>
          <motion.a 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="https://app.periovox.ai" 
            className="inline-block bg-sky-500 text-white px-10 py-5 rounded-full font-medium text-lg hover:bg-sky-600 transition-colors duration-300 shadow-[0_0_40px_rgba(14,165,233,0.4)]"
          >
            {t('cta.button')}
          </motion.a>
        </motion.div>
      </section>
      </main>
      
      {/* Footer */}
      <footer className="bg-[#FAFAFA] pt-20 pb-10 px-6 border-t border-zinc-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center border border-zinc-100">
                  <img src="/Logo Texto.png" className="h-6 object-contain" alt="PerioVoxAI Icon" />
                </div>
                <div>
                  <div className="font-semibold text-xl text-sky-950">PerioVoxAI</div>
                  <div className="text-[10px] tracking-widest text-zinc-400 uppercase mt-0.5">Voice-first dental AI</div>
                </div>
              </div>
              <p className="text-zinc-500 font-light leading-relaxed text-sm mb-8">
                {t('footer.brand')}
              </p>
              <div className="flex gap-4">
                <a href="https://www.facebook.com/periovox" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:border-sky-500 hover:text-sky-500 transition-colors bg-white">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="https://www.instagram.com/periovox.ai" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:border-sky-500 hover:text-sky-500 transition-colors bg-white">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://www.linkedin.com/company/periovox-ai/?viewAsMember=true" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:border-sky-500 hover:text-sky-500 transition-colors bg-white">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="https://wa.me/34690957910" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:border-green-500 hover:text-green-500 transition-colors bg-white">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-6">{t('footer.product')}</h4>
              <ul className="space-y-4 text-zinc-500 font-light text-sm">
                <li><a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-sky-500 transition-colors">{t('nav.features')}</a></li>
                <li><a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="hover:text-sky-500 transition-colors">{t('nav.workflow')}</a></li>
                <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')} className="hover:text-sky-500 transition-colors">{t('nav.contact')}</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-6">{t('footer.legal')}</h4>
              <ul className="space-y-4 text-zinc-500 font-light text-sm">
                <li><a href="/terms-of-use.html" target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 transition-colors">{t('footer.terms')}</a></li>
                <li><a href="/privacy-notice.html" target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 transition-colors">{t('footer.privacy')}</a></li>
                <li><a href="/cookie-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 transition-colors">{t('footer.cookiePolicy')}</a></li>
                <li><button onClick={() => setShowCookieBanner(true)} className="hover:text-sky-500 transition-colors">{t('footer.cookieSettings')}</button></li>
              </ul>
            </div>

            {/* Disclaimer */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-6">{t('footer.disclaimerTitle')}</h4>
              <p className="text-zinc-500 font-light leading-relaxed text-sm">
                {t('footer.disclaimer')}
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-zinc-400 font-light text-sm">{t('footer.rights')}</p>
          </div>
        </div>
      </footer>

      {/* Cookie Banner */}
      {showCookieBanner && !showCookieModal && (
        <div className="fixed bottom-4 right-4 z-50 bg-white p-6 rounded-2xl shadow-lg border border-zinc-100 flex flex-col gap-4 max-w-sm">
          <p className="text-sm text-zinc-600">We use cookies to improve your experience. Please choose your preferences.</p>
          <div className="flex gap-2">
            <button onClick={acceptAllCookies} className="px-4 py-2 bg-sky-500 text-white rounded-full text-sm font-semibold hover:bg-sky-600">Accept all</button>
            <button onClick={declineAllCookies} className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-full text-sm font-semibold hover:bg-zinc-200">Reject all</button>
            <button onClick={() => setShowCookieModal(true)} className="px-4 py-2 bg-white text-zinc-700 border border-zinc-200 rounded-full text-sm font-semibold hover:bg-zinc-50">Manage</button>
          </div>
        </div>
      )}

      {/* Cookie Banner Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/20 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-[#F2F4F7] w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 sm:p-10 overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#5B7282] text-xs font-bold tracking-widest uppercase mb-6 shadow-sm">
                    <Cookie className="w-4 h-4 text-[#38B2AC]" />
                    Cookie Preferences
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-semibold text-[#0B192C] mb-4">Cookie Preferences</h2>
                  <p className="text-[#5B7282] text-lg leading-relaxed max-w-2xl">
                    PerioVoxAI uses strictly necessary cookies and, where applicable, preference, analytics, and banner measurement cookies according to our <a href="/cookie-policy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0B192C] transition-colors">Cookie Policy</a>.
                  </p>
                </div>
                <button 
                  onClick={() => setShowCookieModal(false)}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 shadow-sm transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cards */}
              <div className="space-y-4 mb-10">
                {/* Strictly Necessary */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100/50">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-[#0B192C]">Strictly necessary cookies</h3>
                    <div className="px-3 py-1 rounded-full border border-[#38B2AC]/40 text-[#38B2AC] text-[10px] sm:text-xs font-bold tracking-widest uppercase">
                      Always Active
                    </div>
                  </div>
                  <p className="text-[#5B7282] leading-relaxed">
                    Required for core website and application operation, security, session continuity, and storing consent choices.
                  </p>
                </div>

                {/* Preference */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100/50">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-[#0B192C]">Preference / functionality cookies</h3>
                    <button 
                      onClick={() => toggleSetting('preferences')}
                      className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 ${cookieSettings.preferences ? 'bg-[#38B2AC]' : 'bg-zinc-300'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${cookieSettings.preferences ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[#5B7282] leading-relaxed pr-16">
                    Used to remember choices such as language, display format, and interface preferences where applicable.
                  </p>
                </div>

                {/* Analytics */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100/50">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-[#0B192C]">Analytics / measurement cookies</h3>
                    <button 
                      onClick={() => toggleSetting('analytics')}
                      className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 ${cookieSettings.analytics ? 'bg-[#38B2AC]' : 'bg-zinc-300'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${cookieSettings.analytics ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[#5B7282] leading-relaxed pr-16">
                    Used to understand pages visited, session duration, feature interactions, language usage, and numbering preferences in aggregate.
                  </p>
                </div>

                {/* Advertising */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100/50">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-[#0B192C]">Advertising / banner measurement cookies</h3>
                    <button 
                      onClick={() => toggleSetting('advertising')}
                      className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 ${cookieSettings.advertising ? 'bg-[#38B2AC]' : 'bg-zinc-300'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${cookieSettings.advertising ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[#5B7282] leading-relaxed pr-16">
                    Used only where applicable to measure promotional or partner banner performance without changing the core product experience.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-zinc-200/60">
                <div className="flex flex-wrap gap-4 text-sm font-medium text-[#5B7282]">
                  <a href="/cookie-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#0B192C] transition-colors">Cookie Policy</a>
                  <a href="/privacy-notice.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#0B192C] transition-colors">Privacy Notice</a>
                  <a href="/terms-of-use.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#0B192C] transition-colors">Terms of Use</a>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={savePreferences}
                    className="px-6 py-3 bg-[#004D61] text-white rounded-full text-sm font-semibold hover:bg-[#003a4a] transition-colors"
                  >
                    Save preferences
                  </button>
                  <button 
                    onClick={acceptAllCookies}
                    className="px-6 py-3 bg-white text-[#0B192C] border border-zinc-200 rounded-full text-sm font-semibold hover:bg-zinc-50 transition-colors shadow-sm"
                  >
                    Accept all
                  </button>
                  <button 
                    onClick={declineAllCookies}
                    className="px-6 py-3 bg-white text-[#0B192C] border border-zinc-200 rounded-full text-sm font-semibold hover:bg-zinc-50 transition-colors shadow-sm"
                  >
                    Reject non-essential
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
