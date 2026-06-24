"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/src/components/ui/Header";
import { Fullscreen3DLoader } from "@/src/components/ui/Fullscreen3DLoader";

const Dropzone = dynamic(
  () => import("@/src/components/Dropzone").then((mod) => ({ default: mod.Dropzone })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs tracking-widest uppercase transition-colors duration-500 ease-in-out">
        Loading 3D Engine…
      </div>
    ),
  }
);

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadingStart = useCallback(() => setIsLoading(true), []);
  const handleLoadingEnd = useCallback(() => setIsLoading(false), []);

  return (
    <>
      <Fullscreen3DLoader visible={isLoading} />

      <main className="flex-1 w-full min-h-0 flex flex-col overflow-hidden transition-colors duration-500 ease-in-out">
        <Header />

        <section className="relative flex-1 flex flex-col w-full min-h-0 px-2 pb-2 pt-2 transition-colors duration-500 ease-in-out">
          <Dropzone
            onLoadingStart={handleLoadingStart}
            onLoadingEnd={handleLoadingEnd}
          />
        </section>
      </main>
    </>
  );
}
