"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonLine } from "./SkeletonCard";

import { apiFetch } from "@/lib/api";
import { PaganiModel } from "@/lib/paganiModels";

/**
 * Minimal SVG silhouette of a low sports car.
 * Simple path shapes — no external images.
 */
function CarSilhouette() {
  return (
    <svg viewBox="0 0 120 40" className="w-full h-[40px] text-white/[0.08]" fill="currentColor">
      <path d="M10 30 Q10 28 12 28 L22 28 Q24 28 26 22 L40 14 Q44 12 50 12 L80 12 Q86 12 90 16 L100 24 Q102 26 104 26 L110 26 Q112 26 112 28 L112 30 Q112 32 110 32 L100 32 Q100 32 98 32 A6 6 0 1196 26 A6 6 0 0184 26 A6 6 0 1182 32 L38 32 A6 6 0 1136 26 A6 6 0 0124 26 A6 6 0 1122 32 L12 32 Q10 32 10 30Z" />
      <circle cx="28" cy="30" r="4" className="text-white/[0.04]" fill="currentColor" />
      <circle cx="90" cy="30" r="4" className="text-white/[0.04]" fill="currentColor" />
    </svg>
  );
}

/**
 * Horizontal grid of 5 Pagani model cards.
 * Hover triggers cached AI summary. Staggered entrance animation.
 * Matches dark Pagani theme.
 */
export default function PaganiCarousel() {
  const [models, setModels] = useState<PaganiModel[]>([]);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const summaryCache = useRef<Record<string, string>>({});
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ models: PaganiModel[] }>("/api/v1/models");
        if (data && data.models) {
          setModels(data.models);
          // Pre-populate summaries into cache
          data.models.forEach(m => {
            if (m.summary) summaryCache.current[m.name] = m.summary;
          });
        }
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
    })();
  }, []);

  const handleHover = useCallback(async (modelName: string) => {
    setHoveredModel(modelName);

    if (summaryCache.current[modelName]) {
      setSummaries((prev) => ({ ...prev, [modelName]: summaryCache.current[modelName] }));
      return;
    }

    setLoadingModel(modelName);
    await new Promise((r) => setTimeout(r, 600));
    const summary = "No summary available.";
    summaryCache.current[modelName] = summary;
    setSummaries((prev) => ({ ...prev, [modelName]: summary }));
    setLoadingModel(null);
  }, []);

  const startHover = useCallback((modelName: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      handleHover(modelName);
    }, 150); 
  }, [handleHover]);

  const keepHover = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const clearHover = useCallback((delay = 150) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setHoveredModel(null);
    }, delay); 
  }, []);

  const activeModel = hoveredModel ? models.find((m) => m.name === hoveredModel) : null;

  if (!models.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3
          className="text-xs font-bold text-bright-gold uppercase tracking-[0.15em]"
          style={{ fontFamily: "var(--font-orbitron)" }}
        >
          Pagani Showcase
        </h3>
        <span className="text-[10px] text-gray-600">{models.length} models</span>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {models.map((model, i) => (
          <motion.div
            key={model.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => startHover(model.name)}
            onMouseLeave={() => clearHover(400)}
            className={`rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col ${
              model.featured
                ? "hover:shadow-pagani-gold/10"
                : "hover:shadow-white/5"
            }`}
            style={{
              pointerEvents: hoveredModel && hoveredModel !== model.name ? 'none' : 'auto',
              border: model.featured
                ? "2px solid rgba(212,175,55,0.5)"
                : "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.03)",
            }}
          >
            {/* Image Section — fills the card */}
            <div 
              className="relative w-full h-[120px] flex items-center justify-center overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(25,25,25,0.6) 0%, rgba(10,10,10,0.95) 100%)",
              }}
            >
              {model.imageUrl ? (
                <img 
                  src={model.imageUrl} 
                  alt={model.name} 
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <CarSilhouette />
              )}
              {/* Badge overlay */}
              <span className={`absolute top-2 left-2 text-[8px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider backdrop-blur-sm ${model.badgeColor}`}>
                {model.badge}
              </span>
            </div>

            {/* Text Section */}
            <div className="px-3 py-2.5" style={{ background: "linear-gradient(180deg, rgba(15,15,15,0.95) 0%, rgba(10,10,10,1) 100%)" }}>
              <p className="text-sm text-white font-semibold leading-tight">{model.name}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {model.hp} hp · {model.weight} kg
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Cinematic Half-Page Modal */}
      <AnimatePresence>
        {hoveredModel && activeModel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-12 pointer-events-none"
          >
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-none" 
            />

            {/* Modal Container */}
            <div 
              className="relative w-full max-w-5xl aspect-[2/1] rounded-3xl overflow-hidden shadow-2xl flex border border-white/[0.1] bg-black pointer-events-auto"
              onMouseEnter={keepHover}
              onMouseLeave={() => clearHover(50)}
              style={{
                 background: "linear-gradient(145deg, rgba(20,20,20,0.95) 0%, rgba(5,5,5,1) 100%)",
                 boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 1), 0 0 100px rgba(212, 175, 55, 0.15)"
              }}
            >
               {/* Left Side: Image with Projector Glow */}
               <div className="w-1/2 relative flex items-center justify-center p-8 overflow-hidden">
                  {/* Glowing Projector Beam Effect */}
                  <div className="absolute top-1/2 left-0 w-full h-[120%] -translate-y-1/2 bg-gradient-to-r from-pagani-gold/20 via-pagani-gold/5 to-transparent blur-[60px] -rotate-12 transform-gpu" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-white/5 blur-[80px] rounded-full mix-blend-screen" />
                  
                  {activeModel.imageUrl && (
                    <motion.img 
                      src={activeModel.imageUrl} 
                      alt={activeModel.name}
                      initial={{ opacity: 0, x: -60 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
                      className="relative z-10 w-[120%] max-w-none h-auto object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)] translate-x-[-10%]"
                    />
                  )}
               </div>

               {/* Right Side: Info */}
               <div className="w-1/2 p-14 flex flex-col justify-center border-l border-white/[0.05] relative z-10 bg-gradient-to-l from-black/80 to-transparent">
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                  >
                    <span className={`inline-block text-[11px] px-3 py-1 rounded-full border font-bold uppercase tracking-widest mb-5 shadow-lg ${activeModel.badgeColor}`}>
                      {activeModel.badge}
                    </span>
                    <h2 className="text-5xl font-black text-white mb-3 tracking-wide" style={{ fontFamily: "var(--font-orbitron)" }}>
                      {activeModel.name}
                    </h2>
                    
                    <div className="flex gap-8 mb-10 text-pagani-gold font-mono text-base tracking-widest">
                       <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase mb-1">Power</span>{activeModel.hp} HP</div>
                       <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase mb-1">Weight</span>{activeModel.weight} KG</div>
                    </div>

                    <div className="h-[1px] w-full bg-gradient-to-r from-pagani-gold/30 to-transparent mb-8" />

                    <div className="text-base text-gray-300 leading-relaxed pr-8 font-light">
                      {loadingModel === activeModel.name ? (
                         <div className="space-y-4">
                           <SkeletonLine width="100%" />
                           <SkeletonLine width="90%" />
                           <SkeletonLine width="75%" />
                         </div>
                      ) : (
                        <p className="text-lg">{summaries[activeModel.name]}</p>
                      )}
                    </div>
                  </motion.div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
