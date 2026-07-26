"use client";

import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
}

export default function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="background-vectors">
        <div className="vector-shape vector-circle"></div>
        <div className="vector-shape vector-square"></div>
        <div className="vector-shape vector-triangle"></div>
        <div className="vector-shape vector-hexagon"></div>
      </div>
      <div className="relative z-[1] mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
