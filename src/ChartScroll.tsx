import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { Language } from './translations';
import './chart-scroll.css';

const labels = {
  es: {
    eyebrow: 'Caso de ejemplo, paso a paso',
    title: 'Del primer dato al periodontograma.',
    description: 'Desliza para seguir el registro vestibular del maxilar superior, del 18 al 28.',
    arch: 'MAXILLARY ARCH · BUCCAL',
    complete: 'REGISTRO COMPLETO',
    note: 'Los implantes y los dientes ausentes se identifican durante la exploración.',
    alt: 'Periodontograma vestibular superior de PerioVox con el caso de ejemplo completo.',
  },
  en: {
    eyebrow: 'An example case, step by step',
    title: 'From the first finding to the full chart.',
    description: 'Scroll through the maxillary buccal record, from tooth 18 to 28.',
    arch: 'MAXILLARY ARCH · BUCCAL',
    complete: 'CHART COMPLETE',
    note: 'Implants and missing teeth are identified during the examination.',
    alt: 'PerioVox maxillary buccal periodontal chart showing the completed example case.',
  },
};

export default function ChartScroll({ lang }: { lang: Language }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [complete, setComplete] = useState(false);
  const reduce = useReducedMotion();
  const t = labels[lang];

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => {
      setIsMobile(media.matches);
      setViewportWidth(window.innerWidth);
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const revealX = useTransform(scrollYProgress, [0, 0.025, 0.9, 0.965], [12.5, 12.5, 89.7, 89.7]);
  const revealClip = useTransform(revealX, x => `inset(20% ${100 - x}% 5% 12.5%)`);
  const scanLeft = useTransform(revealX, x => `${x}%`);
  const finalOpacity = useTransform(scrollYProgress, [0.945, 1], [0, 1]);
  const scanOpacity = useTransform(scrollYProgress, [0, 0.025, 0.9, 0.965], [0, 1, 1, 0]);
  const progressScale = useTransform(scrollYProgress, [0, 0.965], [0, 1]);
  const maxMobilePan = Math.max(0, 920 - Math.max(0, viewportWidth - 38));
  const mobilePan = useTransform(scrollYProgress, [0, 0.08, 0.92, 1], [0, 0, -maxMobilePan, -maxMobilePan]);

  useMotionValueEvent(scrollYProgress, 'change', value => {
    setComplete(previous => previous === (value >= 0.965) ? previous : value >= 0.965);
  });

  return (
    <section className="chart-story" id="chart" ref={sectionRef} aria-labelledby="chart-story-title">
      <div className="chart-story-sticky">
        <div className="chart-story-heading">
          <span className="chart-story-eyebrow"><i aria-hidden="true" />{t.eyebrow}</span>
          <h2 id="chart-story-title">{t.title}</h2>
          <p>{t.description}</p>
        </div>

        <div className="chart-story-frame">
          <div className="chart-story-frame-top" aria-hidden="true"><span>PERIOVOX / CLINICAL WORKSPACE</span><span>{t.arch}</span></div>
          <div className="chart-story-window">
            {reduce ? (
              <img className="chart-story-reduced" src="/periodontogram-final.png" alt={t.alt} width="2372" height="1240" loading="lazy" />
            ) : (
              <motion.div className="chart-story-canvas" style={{ x: isMobile ? mobilePan : 0 }} aria-hidden="true">
                <img className="chart-story-start" src="/periodontogram-start.png" alt="" width="2364" height="1260" loading="lazy" />
                <motion.img className="chart-story-reveal" src="/periodontogram-final.png" alt="" width="2372" height="1240" loading="lazy" style={{ clipPath: revealClip }} />
                <motion.div className="chart-story-scan" style={{ left: scanLeft, opacity: scanOpacity }} />
                <motion.img className="chart-story-final" src="/periodontogram-final.png" alt="" width="2372" height="1240" loading="lazy" style={{ opacity: finalOpacity }} />
              </motion.div>
            )}
          </div>
        </div>

        <div className="chart-story-footer">
          <div className="chart-story-progress" aria-hidden="true"><motion.span style={{ scaleX: reduce ? 1 : progressScale }} /></div>
          <span className="chart-story-status" role="status">{reduce || complete ? t.complete : ''}</span>
          <p>{t.note}</p>
        </div>
        <span className="chart-story-sr-only">{t.alt}</span>
      </div>
    </section>
  );
}
