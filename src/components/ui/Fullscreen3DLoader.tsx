"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

interface Fullscreen3DLoaderProps {
  visible: boolean;
}

export function Fullscreen3DLoader({ visible }: Fullscreen3DLoaderProps) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="fullscreen-3d-loader"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading 3D model, please wait"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className={[
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-8",
            "bg-slate-50/90 dark:bg-neutral-950/90",
            "backdrop-blur-sm",
            "transition-colors duration-500 ease-in-out",
          ].join(" ")}
        >
          {/* Breathing logo */}
          <motion.div
            animate={{
              scale: [1, 1.07, 1],
              opacity: [0.88, 1, 0.88],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative select-none"
          >
            <Image
              src="/Logo.png"
              alt="Web3DViewer"
              width={220}
              height={56}
              priority
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-sm dark:brightness-110 dark:contrast-[1.02]"
              style={{ width: "auto" }}
            />
          </motion.div>

          {/* Progress + label */}
          <div className="flex flex-col items-center gap-3 px-6 max-w-xs sm:max-w-sm">
            <p className="text-center text-sm font-light tracking-wide text-slate-600 dark:text-neutral-400 transition-colors duration-500">
              Loading 3D Model&hellip; Please Wait.
            </p>

            <div
              className="relative h-1 w-48 sm:w-56 overflow-hidden rounded-full bg-slate-200/80 dark:bg-neutral-800/80"
              aria-hidden="true"
            >
              <div className="loader-shimmer-bar absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-blue-500 to-transparent dark:via-blue-400" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
