"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { PaganiModel } from "@/lib/paganiModels";
import { SkeletonLine } from "./SkeletonCard";

export default function ModelComparison() {
  const [models, setModels] = useState<PaganiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelA, setModelA] = useState<PaganiModel | null>(null);
  const [modelB, setModelB] = useState<PaganiModel | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ models: PaganiModel[] }>("/api/v1/models");
        if (data && data.models && data.models.length >= 2) {
          setModels(data.models);
          setModelA(data.models[0]);
          setModelB(data.models[1]);
        }
      } catch (err) {
        console.error("Failed to fetch models for comparison", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-10 h-10 border-2 border-pagani-gold/30 border-t-pagani-gold rounded-full"
        />
        <p className="text-gray-500 text-xs mt-4 uppercase tracking-widest font-mono">Loading telemetry...</p>
      </div>
    );
  }

  if (models.length < 2) {
    return <div className="p-8 text-gray-500">Not enough models available for comparison.</div>;
  }

  const renderSelector = (current: PaganiModel | null, setter: (m: PaganiModel) => void, exclude: PaganiModel | null) => (
    <div className="relative group z-20">
      <select 
        value={current?.name || ""}
        onChange={(e) => {
          const selected = models.find(m => m.name === e.target.value);
          if (selected) setter(selected);
        }}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-pagani-gold/50 appearance-none cursor-pointer transition-colors"
        style={{ fontFamily: "var(--font-orbitron)" }}
      >
        {models.map(m => (
          <option key={m.name} value={m.name} disabled={m.name === exclude?.name} className="bg-black text-white">
            {m.name}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pagani-gold">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );

  const renderModelColumn = (model: PaganiModel | null, isLeft: boolean) => {
    if (!model) return <div className="flex-1" />;

    return (
      <motion.div 
        key={model.name}
        initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: isLeft ? -20 : 20 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex-1 flex flex-col gap-6"
      >
        {/* Image Container */}
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-white/[0.05] shadow-2xl flex items-center justify-center bg-gradient-to-b from-black/80 to-black/95">
          {/* Subtle Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-white/5 blur-[50px] rounded-full mix-blend-screen" />
          
          {model.imageUrl ? (
            <img 
              src={model.imageUrl} 
              alt={model.name} 
              className="relative z-10 w-[90%] h-auto object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="text-gray-600 text-sm">Image unavailable</div>
          )}
          <span className={`absolute top-4 ${isLeft ? 'left-4' : 'right-4'} text-[9px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-widest backdrop-blur-sm z-20 shadow-lg ${model.badgeColor}`}>
            {model.badge}
          </span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-center items-center relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
            <div className="absolute -inset-1 bg-gradient-to-br from-pagani-gold/20 to-transparent opacity-0 group-hover:opacity-100 blur transition-opacity" />
            <span className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-1 relative z-10">Power Output</span>
            <span className="text-2xl font-black text-white relative z-10 font-mono tracking-wider">{model.hp} <span className="text-pagani-gold text-sm">HP</span></span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-center items-center relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
            <div className="absolute -inset-1 bg-gradient-to-br from-pagani-gold/20 to-transparent opacity-0 group-hover:opacity-100 blur transition-opacity" />
            <span className="text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-1 relative z-10">Dry Weight</span>
            <span className="text-2xl font-black text-white relative z-10 font-mono tracking-wider">{model.weight} <span className="text-pagani-gold text-sm">KG</span></span>
          </div>
        </div>

        {/* Ratio */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex justify-between items-center px-6">
           <span className="text-gray-400 text-xs uppercase tracking-widest">Power-to-Weight</span>
           <span className="text-pagani-gold font-mono font-bold text-lg">{(model.hp / model.weight).toFixed(3)} <span className="text-xs text-gray-500">HP/KG</span></span>
        </div>

        {/* Extended Specs */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl flex flex-col overflow-hidden">
          {model.engine && (
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.05]">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest">Engine</span>
              <span className="text-white text-xs font-semibold text-right">{model.engine}</span>
            </div>
          )}
          {model.topSpeed && (
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.05]">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest">Top Speed</span>
              <span className="text-white text-xs font-semibold">{model.topSpeed}</span>
            </div>
          )}
          {model.acceleration && (
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.05]">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest">Acceleration</span>
              <span className="text-white text-xs font-semibold">{model.acceleration}</span>
            </div>
          )}
          {model.productionUnits && (
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.05]">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest">Production Units</span>
              <span className="text-pagani-gold text-xs font-bold">{model.productionUnits} Worldwide</span>
            </div>
          )}
          {model.price && (
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-gray-500 text-[10px] uppercase tracking-widest">Base Price</span>
              <span className="text-green-400 text-xs font-mono">{model.price}</span>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 relative">
          <div className="absolute top-0 left-6 w-12 h-[1px] bg-pagani-gold" />
          <p className="text-gray-300 text-sm leading-relaxed font-light">
            {model.summary || "Detailed telemetry and summary currently unavailable for this model."}
          </p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center mb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-orbitron)" }}>
          Telemetry <span className="text-pagani-gold">Comparison</span>
        </h2>
        <p className="text-gray-500 text-xs uppercase tracking-[0.2em]">Select models to compare technical specifications</p>
      </div>

      {/* Selectors */}
      <div className="flex gap-12 w-full relative z-30">
        <div className="flex-1">{renderSelector(modelA, setModelA, modelB)}</div>
        <div className="flex items-center justify-center w-12 shrink-0">
          <div className="w-8 h-8 rounded-full bg-pagani-gold/10 border border-pagani-gold/30 flex items-center justify-center text-pagani-gold text-xs font-bold">
            VS
          </div>
        </div>
        <div className="flex-1">{renderSelector(modelB, setModelB, modelA)}</div>
      </div>

      {/* Comparison Area */}
      <div className="flex gap-12 w-full relative">
        {/* Decorative VS Divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent -translate-x-1/2" />
        
        <AnimatePresence mode="popLayout">
          {renderModelColumn(modelA, true)}
        </AnimatePresence>
        
        <div className="w-12 shrink-0" /> {/* Spacer for VS Divider */}
        
        <AnimatePresence mode="popLayout">
          {renderModelColumn(modelB, false)}
        </AnimatePresence>
      </div>
    </div>
  );
}
