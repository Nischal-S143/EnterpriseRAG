"use client";

import { useRef } from "react";
import { useScroll } from "framer-motion";
import ZondaScrollCanvas from "@/components/ZondaScrollCanvas";
import ZondaExperience from "@/components/ZondaExperience";
import Navbar from "@/components/Navbar";

export default function Home() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <main className="bg-pagani-black min-h-screen text-white selection:bg-pagani-gold selection:text-black">
      <Navbar />

      {/* SCROLL SEQUENCE (Locked for 600vh) */}
      <section ref={containerRef} className="h-[600vh] relative">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Background Canvas */}
          <div className="absolute inset-0 z-0">
            <ZondaScrollCanvas scrollYProgress={scrollYProgress} />
          </div>

          {/* HUD Overlay */}
          <div className="absolute inset-0 z-10">
            <ZondaExperience scrollYProgress={scrollYProgress} />
          </div>
        </div>
      </section>

      {/* REST OF SITE */}
      <div className="relative z-20 bg-pagani-black border-t border-white/10">
        <SpecsGrid />
        <Features />
        <Footer />
      </div>
    </main>
  );
}

// Placeholders / Sub-sections
function SpecsGrid() {
  return (
    <section className="py-24 px-8 md:px-20 border-b border-white/10 bg-pagani-black">
      <h3 className="text-4xl uppercase font-bold mb-12 text-white/90">Technical Specifications</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: "Engine", value: "Mercedes-Benz AMG V12" },
          { label: "Displacement", value: "5987 cc" },
          { label: "Power", value: "750 hp @ 7,500 rpm" },
          { label: "Torque", value: "710 Nm @ 5,700 rpm" },
          { label: "Weight", value: "1,070 kg" },
          { label: "0-100 km/h", value: "2.7 sec" },
          { label: "Max Speed", value: "> 350 km/h" },
          { label: "Production", value: "15 units" },
        ].map((item, i) => (
          <div key={i} className="border-t border-pagani-gold/30 pt-4 hover:border-pagani-gold transition-colors duration-300">
            <div className="text-pagani-gold text-sm uppercase tracking-wider mb-1">{item.label}</div>
            <div className="text-xl md:text-2xl font-light">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className="min-h-screen flex items-center justify-center border-b border-white/10 bg-carbon-gray/10 relative overflow-hidden">
      {/* Abstract background element */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#1a1a1a_100%)] opacity-80" />

      <div className="max-w-5xl text-center relative z-10 px-6">
        <h3 className="text-5xl md:text-8xl font-bold uppercase mb-8 leading-none tracking-tighter">
          The Sound of <span className="text-pagani-gold block md:inline">Perfection</span>
        </h3>
        <p className="text-xl text-gray-400 font-light leading-relaxed max-w-2xl mx-auto">
          The Zonda R is the ultimate expression of the Zonda philosophy. A track-focused machine that knows no compromises, delivering an unfiltered driving experience.
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 px-8 md:px-20 text-center text-gray-600 text-xs uppercase tracking-widest bg-pagani-black">
      <p>&copy; {new Date().getFullYear()} Pagani Automobili. Tribute Project.</p>
    </footer>
  )
}
