"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import webPackage from "../../../../package.json";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="absolute inset-0 z-0 opacity-5" aria-hidden="true">
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 translate-y-1/3 rounded-full bg-green-300 blur-3xl dark:bg-green-700"></div>
        <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/3 -translate-y-1/3 rounded-full bg-green-200 blur-3xl dark:bg-green-800"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          <div className="col-span-1 md:col-span-3">
            <h2 className="text-gradient text-2xl font-bold text-green-600 dark:text-green-400">
              ConvoLens
            </h2>
            <p className="mt-4 max-w-md text-gray-600 dark:text-gray-400">
              Preserve the WhatsApp conversation you need to keep — for
              yourself or your team.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-500">
              Import by WhatsApp text export or browser extension. Additional
              import paths are planned as the private preview expands.
            </p>
            <Badge variant="preview" className="mt-5 uppercase tracking-wider">
              Private preview
            </Badge>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
              Product
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/features"
                  className="text-gray-600 transition-colors duration-200 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-gray-600 transition-colors duration-200 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300">
              Preview
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/login?redirectTo=/dashboard/import"
                  className="text-gray-600 transition-colors duration-200 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                >
                  Import a conversation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between border-t border-gray-200 pt-8 dark:border-gray-700 md:flex-row">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>
              &copy; {new Date().getFullYear()} ConvoLens. All rights reserved.
            </p>
            <p className="mt-1 text-xs">App v{webPackage.version}</p>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 md:mt-0">
            Use only conversations you are authorized to upload.
          </p>
        </div>
      </div>
    </footer>
  );
}
