import React, { useRef, useEffect, useState, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link as LinkIcon, Scissors } from 'lucide-react';
import TiltCard from './ui/TiltCard';

gsap.registerPlugin(ScrollTrigger);

const PageLoader = ({ onComplete }) => {
  const containerRef = useRef(null);
  const fixedContentRef = useRef(null);
  const gridRef = useRef(null);
  const cardRef = useRef(null);
  const orbsRef = useRef(null);
  const nodesRef = useRef(null);
  const particlesRef = useRef(null);
  const bgGlowRef = useRef(null);
  const ringsRef = useRef(null);
  const innerCardRef = useRef(null);

  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const tlRef = useRef(null);

  // Generate 40 warp particles with random initial positions
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 2500,
      y: (Math.random() - 0.5) * 2500,
      z: -3000 - (Math.random() * 2000),
      color: Math.random() > 0.5 ? 'var(--primary)' : 'var(--emerald-500)'
    }));
  }, []);

  // Matrix Scramble Text logic
  const massiveUrl = "https://shorty.url/api/v1/routing/complex?ref=ui&tracking_id=898723498723498&hash=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567";
  const targetLength = 18;
  const currentLength = Math.max(targetLength, massiveUrl.length - Math.floor((progress / 100) * (massiveUrl.length - targetLength)));

  // Create a scrambled version of the text
  const scrambleChars = '!<>-_\\/[]{}—=+*^?#_';
  const displayUrl = useMemo(() => {
    if (progress === 100) return "https://shorty.url";

    let result = massiveUrl.substring(0, currentLength);
    // Scramble the last 5 characters for glitch effect
    if (progress > 5 && progress < 95) {
      const charsArray = result.split('');
      for (let i = Math.max(0, charsArray.length - 8); i < charsArray.length; i++) {
        if (Math.random() > 0.3) {
          charsArray[i] = scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }
      }
      result = charsArray.join('');
    }
    return result + (progress < 100 ? "..." : "");
  }, [progress, currentLength, massiveUrl]);

  // Handle Mouse Spotlight
  const handleMouseMove = (e) => {
    if (!fixedContentRef.current) return;
    const { clientX, clientY } = e;
    const { left, top } = fixedContentRef.current.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    fixedContentRef.current.style.setProperty('--mouse-x', `${x}px`);
    fixedContentRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  // Respect user motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      if (onComplete) onComplete();
      return undefined;
    }

    window.scrollTo(0, 0);
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    // gsap.context scopes selectors and auto-tracks every tween/ScrollTrigger
    // created inside, so ctx.revert() kills them all on unmount.
    // NOTE: ctx is never referenced inside the callback itself (that would be a
    // temporal-dead-zone error since gsap.context invokes the callback
    // synchronously before the const assignment completes). Scoped element
    // lookups use containerRef.current.querySelectorAll instead of ctx.query.
    const ctx = gsap.context(() => {
      // --- INITIAL ENTRY ASSEMBLY ANIMATION ---
      const entryTl = gsap.timeline();

      gsap.set(innerCardRef.current, { scaleY: 0, opacity: 0 });
      gsap.set(ringsRef.current, { scale: 0, rotation: -180 });
      gsap.set('.glitch-text', { opacity: 0, y: 20 });
      gsap.set('.data-node', { opacity: 0, scale: 0 });

      entryTl
        .to(innerCardRef.current, { scaleY: 1, opacity: 1, duration: 0.8, ease: "power3.out" })
        .to(ringsRef.current, { scale: 1, rotation: 0, duration: 1, ease: "elastic.out(1, 0.5)" }, "-=0.4")
        .to('.glitch-text', { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, "-=0.6")
        .to('.data-node', { opacity: 0.3, scale: 1, duration: 0.8, stagger: 0.1, ease: "back.out(1.2)" }, "-=0.4");

      // --- SCROLL SEQUENCE ANIMATION ---
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
          pin: fixedContentRef.current,
          onUpdate: (self) => {
            const currentProgress = Math.floor(self.progress * 100);
            setProgress(currentProgress);

            if (self.progress >= 0.99 && onComplete && !completedRef.current) {
              completedRef.current = true;
              document.body.style.overflow = 'auto';
              document.documentElement.style.overflow = 'auto';
              setTimeout(() => onComplete(), 100);
            }
          },
          onLeave: () => {
            if (onComplete && !completedRef.current) {
              completedRef.current = true;
              document.body.style.overflow = 'auto';
              document.documentElement.style.overflow = 'auto';
              setTimeout(() => onComplete(), 100);
            }
          }
        }
      });

      tlRef.current = tl;

      // Stage 1: The Dive (0% to 30%)
      tl.to(gridRef.current, { rotateX: 10, scale: 2.5, opacity: 0.8, backgroundPosition: "0px 800px", ease: "power1.inOut", duration: 3 }, 0)
        .to(cardRef.current, { scale: 0.85, y: 30, ease: "power1.inOut", duration: 3 }, 0);

      const nodes = containerRef.current.querySelectorAll('.data-node');
      nodes.forEach((node, i) => {
        tl.to(node, { opacity: 1, duration: 0.5 }, 0 + (i * 0.2));
        tl.to(node, { z: 800, x: (i % 2 === 0 ? -400 : 400), y: (i < 2 ? -300 : 300), duration: 3 + (i * 0.2), ease: "power2.in" }, 0);
      });

      // Stage 2: The Compression & Warp Speed (30% to 60%)
      tl.to(gridRef.current, { scale: 4, opacity: 0, backgroundPosition: "0px 1500px", ease: "power2.in", duration: 3 }, 3)
        .to(orbsRef.current, { scale: 4, opacity: 0, duration: 3 }, 3);

      nodes.forEach((node) => tl.to(node, { opacity: 0, duration: 1 }, 3));
      tl.to(cardRef.current, { rotateY: 360, duration: 3, ease: "power1.inOut" }, 3);

      // Warp Particles trigger
      const warpParticles = containerRef.current.querySelectorAll('.warp-particle');
      warpParticles.forEach((particle) => {
        tl.to(particle, {
          z: 1500, // blast past camera
          opacity: 1,
          duration: 1.5 + Math.random(),
          ease: "power4.in"
        }, 3 + (Math.random() * 1.5));
      });

      // Stage 3: Core Ignition (60% to 85%)
      tl.to(bgGlowRef.current, { opacity: 1, duration: 2.5 }, 6)
        .to(ringsRef.current, { scale: 1.6, duration: 2.5, ease: "back.out(1.5)" }, 6);

      // Stage 4: Blast Through (85% to 100%)
      tl.to(cardRef.current, { scale: 20, opacity: 0, duration: 1.5, ease: "power3.in" }, 8.5)
        .to(fixedContentRef.current, { opacity: 0, duration: 0.5 }, 9.5);
    }, containerRef.current);

    return () => {
      // Kills every GSAP animation and ScrollTrigger created inside the context.
      ctx.revert();
      tlRef.current = null;
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [onComplete, prefersReducedMotion]);

  return (
    <div ref={containerRef} className="h-[400vh] w-full bg-slate-950 relative z-[100]">
      {/* Interactive Spotlight Wrapper */}
      <div
        ref={fixedContentRef}
        onMouseMove={handleMouseMove}
        className="h-[100dvh] w-full flex flex-col items-center justify-center relative perspective-1000 bg-background"
        style={{
          '--mouse-x': '50vw',
          '--mouse-y': '50vh',
          background: 'radial-gradient(circle 800px at var(--mouse-x) var(--mouse-y), rgba(59,130,246,0.1), transparent 80%)'
        }}
      >

        {/* Dynamic Background Glow Layer */}
        <div ref={bgGlowRef} className="absolute inset-0 bg-emerald-950/40 opacity-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--emerald-500)_0%,transparent_50%)] opacity-30 blur-3xl mix-blend-screen"></div>
        </div>

        {/* 3D Grid */}
        <div
          ref={gridRef}
          className="absolute inset-0 bg-[linear-gradient(var(--glow-blue)_2px,transparent_2px),linear-gradient(90deg,var(--glow-blue)_2px,transparent_2px)] bg-[size:50px_50px] opacity-40 origin-bottom [transform-style:preserve-3d] pointer-events-none"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 15%, black 70%)', maskImage: 'linear-gradient(to bottom, transparent 15%, black 70%)' }}
        ></div>

        {/* Warp Particles Layer */}
        <div ref={particlesRef} className="absolute inset-0 w-full h-full pointer-events-none perspective-1000 [transform-style:preserve-3d] z-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="warp-particle absolute w-[2px] h-[40px] rounded-full opacity-0"
              style={{
                left: '50%',
                top: '50%',
                backgroundColor: p.color,
                boxShadow: `0 0 10px ${p.color}`,
                transform: `translateX(${p.x}px) translateY(${p.y}px) translateZ(${p.z}px)`
              }}
            ></div>
          ))}
        </div>

        {/* Ambient Orbs */}
        <div ref={orbsRef} className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center z-0">
          <div className="orb bg-primary w-72 h-72 absolute -top-32 -left-32 animate-float"></div>
          <div className="orb bg-secondary w-72 h-72 absolute -bottom-32 -right-32 animate-float" style={{ animationDelay: '-5s' }}/>
        </div>

        {/* 3D Parallax Data Nodes */}
        <div ref={nodesRef} className="hidden md:flex absolute inset-0 w-full h-full pointer-events-none items-center justify-center perspective-1000 z-10">
          <div className="data-node absolute top-[20%] left-[10%] p-4 glass-panel rounded-xl border border-primary/30 text-[10px] font-mono text-primary opacity-0 shadow-lg shadow-primary/20" style={{ transform: 'translateZ(-600px) rotateY(15deg)' }}>
            <p className="font-bold mb-1">ROUTING: /api/v1/auth</p>
            <p>NODE: 192.168.1.104</p>
            <p>LATENCY: 12ms</p>
          </div>
          <div className="data-node absolute bottom-[25%] right-[10%] p-4 glass-panel rounded-xl border border-secondary/30 text-[10px] font-mono text-secondary opacity-0 shadow-lg shadow-secondary/20" style={{ transform: 'translateZ(-800px) rotateY(-20deg)' }}>
            <p className="font-bold mb-1">RESOLVING HASH...</p>
            <p>MATCH: xyz789</p>
            <p>CACHE: HIT</p>
          </div>
          <div className="data-node absolute top-[15%] right-[20%] p-4 glass-panel rounded-xl border border-emerald-500/30 text-[10px] font-mono text-emerald-400 opacity-0 shadow-lg shadow-emerald-500/20" style={{ transform: 'translateZ(-400px) rotateX(10deg)' }}>
            <p className="font-bold mb-1">SECURE CONNECTION</p>
            <p>TLS v1.3 ESTABLISHED</p>
          </div>
          <div className="data-node absolute bottom-[15%] left-[15%] p-4 glass-panel rounded-xl border border-purple-500/30 text-[10px] font-mono text-purple-400 opacity-0 shadow-lg shadow-purple-500/20" style={{ transform: 'translateZ(-500px) rotateX(-15deg)' }}>
            <p className="font-bold mb-1">COMPRESSING PAYLOAD</p>
            <p>RATIO: 94.2%</p>
          </div>
        </div>

        {/* Center UI */}
        <div ref={cardRef} className="relative z-20 w-full max-w-sm px-6 md:px-0 [transform-style:preserve-3d]">
          <TiltCard tiltMaxAngleX={15} tiltMaxAngleY={15}>
            <div ref={innerCardRef} className="flex flex-col items-center gap-8 p-12 glass-panel rounded-3xl border border-border-glass text-center shadow-[0_0_50px_rgba(59,130,246,0.2)] bg-surface-glass backdrop-blur-xl origin-bottom">

              {/* 3D Rotating Loader */}
              <div ref={ringsRef} className="relative w-24 h-24 perspective-1000 drop-shadow-[0_0_20px_var(--primary)] flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-t-primary border-r-secondary border-b-transparent border-l-transparent rounded-full animate-[spin_2s_linear_infinite] [transform-style:preserve-3d]"></div>
                <div className="absolute inset-2 border-4 border-t-transparent border-r-transparent border-b-primary border-l-secondary rounded-full animate-[spin_1.5s_linear_infinite_reverse] [transform-style:preserve-3d]"></div>

                {/* Center Glowing Icon */}
                <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-primary/20 shadow-[0_0_30px_var(--primary)] animate-pulse flex items-center justify-center backdrop-blur-md border border-primary/30">
                  {progress < 100 ? (
                    <Scissors className="w-5 h-5 text-primary animate-bounce" />
                  ) : (
                    <LinkIcon className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  )}
                </div>
              </div>

              <div className="space-y-4 w-full overflow-hidden glitch-text">
                <div>
                  <h2 className="text-xl font-display-lg text-on-surface premium-glow-text tracking-widest animate-pulse">
                    {progress === 100 ? "READY" : "SHRINKING URL"}
                  </h2>

                  {/* Dynamic Scrambling URL */}
                  <div className="mt-3 bg-background/50 border border-border-glass rounded-lg p-3 overflow-hidden relative shadow-inner">
                    <p className="font-mono text-primary truncate text-xs transition-all duration-75">
                      {displayUrl}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full space-y-2 glitch-text">
                  <div className="flex justify-between text-xs font-bold text-primary uppercase">
                    <span>Compression</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden shadow-inner border border-border-glass relative">
                    <div
                      className="h-full bg-accent-gradient shadow-[0_0_10px_var(--primary)] transition-all duration-75"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-16 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce text-text-muted glitch-text">
          <span className="material-symbols-outlined text-3xl">keyboard_arrow_down</span>
          <span className="font-label-sm text-[10px] tracking-widest uppercase mt-2 font-bold">Scroll Down</span>
        </div>

      </div>
    </div>
  );
};

export default PageLoader;
