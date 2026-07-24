"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 z-0 opacity-5">
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-green-300 dark:bg-green-700 rounded-full filter blur-3xl translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute left-0 top-0 w-64 h-64 bg-green-200 dark:bg-green-800 rounded-full filter blur-3xl -translate-x-1/3 -translate-y-1/3"></div>
      </div>

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and description */}
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 text-gradient">
              ConvoLens
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-md">
              An early conversation-intake workspace. WhatsApp is the first live
              connector; more platforms are planned.
            </p>
            <p className="mt-5 inline-flex rounded-full border border-green-200 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-700 dark:border-green-800 dark:text-green-300">
              Alpha
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Product
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/features"
                  className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Alpha
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/login?redirectTo=/dashboard"
                  className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                >
                  Join the alpha
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/import"
                  className="text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                >
                  Import a conversation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} ConvoLens. All rights reserved.
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 md:mt-0">
            WhatsApp connector available now · More sources planned
          </p>
        </div>
      </div>
    </footer>
  );
}
