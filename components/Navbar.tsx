"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

export default function Navbar() {
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() ?? 0;
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
        setScrolled(latest > 50);
    });

    return (
        <motion.nav
            variants={{
                visible: { y: 0 },
                hidden: { y: "-100%" },
            }}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 transition-colors duration-500 ${scrolled ? "bg-pagani-black/80 backdrop-blur-md border-b border-white/10" : "bg-transparent"
                }`}
        >
            <div className="text-2xl font-bold tracking-tighter uppercase text-white">
                Pagani <span className="text-pagani-gold">Zonda R</span>
            </div>

            <button className="hidden md:block text-xs font-bold tracking-[0.2em] uppercase text-white border border-white/20 px-6 py-2 hover:bg-white hover:text-black transition-all">
                Menu
            </button>
        </motion.nav>
    );
}
