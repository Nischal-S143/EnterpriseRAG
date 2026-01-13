"use client";

import { useTransform, MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface ZondaScrollCanvasProps {
    scrollYProgress: MotionValue<number>;
}

export default function ZondaScrollCanvas({ scrollYProgress }: ZondaScrollCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [images, setImages] = useState<HTMLImageElement[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const frameCount = 240;

    // Preload Images
    useEffect(() => {
        const loadedImages: HTMLImageElement[] = [];
        let loadedCount = 0;

        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            img.src = `/images/zonda-sequence/${i}.jpg`;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === frameCount) setIsLoaded(true);
            };
            loadedImages.push(img);
        }
        setImages(loadedImages);
    }, []);

    // Sync Canvas to Scroll
    const frameIndex = useTransform(scrollYProgress, [0, 1], [0, frameCount - 1]);

    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas || images.length === 0) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const currentFrame = Math.round(frameIndex.get());
            const image = images[currentFrame];

            // Safe guard
            if (!image) return;

            const dpr = window.devicePixelRatio || 1;
            // Use window inner sizes to fill screen
            // Or parent container size? "fixed inset-0" means window size usually.
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Resize canvas only if needed to avoid clearing unnecessarily? 
            // Actually we must clear to draw next frame.
            // And we must match window size.
            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                ctx.scale(dpr, dpr);
            }

            // Draw Logic - Contain
            // We want to center the image and contain it within width/height
            const scale = Math.min(width / image.width, height / image.height);
            const w = image.width * scale;
            const h = image.height * scale;
            const x = (width - w) / 2;
            const y = (height - h) / 2;

            ctx.clearRect(0, 0, width, height); // Clear valid rect

            // Optional: Smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            ctx.drawImage(image, x, y, w, h);
        };

        // Subscriptions
        const unsubscribe = frameIndex.on("change", render);
        window.addEventListener("resize", render);

        // Initial Render
        if (isLoaded) render();

        return () => {
            unsubscribe();
            window.removeEventListener("resize", render);
        };
    }, [frameIndex, images, isLoaded]);

    return (
        <canvas
            ref={canvasRef}
            className="block w-full h-full object-contain"
        />
    );
}
