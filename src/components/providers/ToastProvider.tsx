"use client";

import { Toaster } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-center"
      gutter={12}
      containerStyle={{ bottom: 32 }}
      toastOptions={{
        duration: 5000,
        className: [
          "!rounded-xl !px-4 !py-3 !text-sm !font-medium !shadow-xl !backdrop-blur-md",
          "!bg-white/95 !text-slate-800 !border !border-slate-200/80",
          "dark:!bg-neutral-900/95 dark:!text-neutral-100 dark:!border-neutral-700/80",
        ].join(" "),
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}
