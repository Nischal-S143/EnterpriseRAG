"use client";

import { motion, useTransform, MotionValue } from "framer-motion";
import { carData } from "@/data/carData";

interface ZondaExperienceProps {
    scrollYProgress: MotionValue<number>;
}

export default function ZondaExperience({ scrollYProgress }: ZondaExperienceProps) {
    // --- Phase 1: Hero (0% - 33%) ---
    const heroOpacity = useTransform(scrollYProgress, [0, 0.25, 0.33], [1, 1, 0]);
    const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -50]);
    const heroScale = useTransform(scrollYProgress, [0, 0.33], [1, 0.9]);

    // --- Phase 2: Design (33% - 66%) ---
    const designOpacity = useTransform(scrollYProgress, [0.33, 0.4, 0.6, 0.66], [0, 1, 1, 0]);
    const designY = useTransform(scrollYProgress, [0.33, 0.4, 0.6, 0.66], [50, 0, 0, -50]);

    // --- Phase 3: Engine (66% - 100%) ---
    const engineOpacity = useTransform(scrollYProgress, [0.66, 0.73, 1], [0, 1, 1]);
    const engineX = useTransform(scrollYProgress, [0.66, 0.73], [50, 0]);

    return (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-center text-white px-8 md:px-20">

            {/* HERO PHASE */}
            <motion.div
                style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center"
            >
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
                    {carData.hero.title}
                </h1>
                <p className="text-pagani-gold text-2xl md:text-3xl font-light tracking-[0.2em] mb-12">
                    {carData.hero.price}
                </p>
                <button className="pointer-events-auto border border-pagani-gold/50 text-pagani-gold px-8 py-3 uppercase tracking-widest hover:bg-pagani-gold hover:text-pagani-black Transition-all duration-300">
                    {carData.hero.cta}
                </button>
            </motion.div>

            {/* DESIGN PHASE */}
            <motion.div
                style={{ opacity: designOpacity, y: designY }}
                className="absolute left-10 md:left-20 max-w-xl"
            >
                <h2 className="text-pagani-gold text-sm md:text-base uppercase tracking-[0.3em] mb-2">
                    {carData.design.title}
                </h2>
                <h3 className="text-4xl md:text-6xl font-bold uppercase leading-none mb-6">
                    {carData.design.feature}
                </h3>
                <p className="text-gray-300 text-lg md:text-xl font-light leading-relaxed border-l-2 border-pagani-gold pl-6">
                    {carData.design.description}
                </p>
            </motion.div>

            {/* ENGINE PHASE */}
            <motion.div
                style={{ opacity: engineOpacity, x: engineX }}
                className="absolute right-10 md:right-20 text-right"
            >
                <h2 className="text-pagani-gold text-sm md:text-base uppercase tracking-[0.3em] mb-6">
                    {carData.engine.title}
                </h2>
                <div className="space-y-8">
                    {carData.engine.specs.map((spec, i) => (
                        <div key={i} className="flex flex-col items-end">
                            <span className="text-4xl md:text-6xl font-bold text-white">{spec.value}</span>
                            <span className="text-gray-400 uppercase tracking-wider text-sm">{spec.label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

        </div>
    );
}
