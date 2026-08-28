"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart2, Home, Sparkles, Upload } from "lucide-react";

export const useNavigation = (isAuthenticated: boolean = false) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !(userDropdownRef.current as HTMLElement).contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const toggleUserDropdown = () => setUserDropdownOpen((open) => !open);

  const handleUserMenuItemClick = (
    event: React.MouseEvent,
    callback?: () => void,
  ) => {
    event.preventDefault();
    setUserDropdownOpen(false);
    callback?.();
  };

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/features", label: "How it works", icon: Sparkles },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: BarChart2,
      requiresAuth: true,
    },
    {
      href: "/dashboard/import",
      label: "Import",
      icon: Upload,
      requiresAuth: true,
    },
  ];

  return {
    isScrolled,
    mobileMenuOpen,
    userDropdownOpen,
    toggleMobileMenu,
    closeMobileMenu,
    toggleUserDropdown,
    handleUserMenuItemClick,
    userDropdownRef,
    mobileMenuRef,
    filteredNavItems: navItems.filter(
      (item) => !item.requiresAuth || isAuthenticated,
    ),
  };
};
