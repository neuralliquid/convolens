"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home,
  BarChart2,
  Users,
  Settings,
  Bell,
  Palette,
  Sparkles,
  Upload,
} from "lucide-react";

export const useNavigation = (isAuthenticated: boolean = false) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const mobileMenuRef = useRef(null);
  const searchBarRef = useRef(null);
  const moreDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreDropdownRef.current &&
        !(moreDropdownRef.current as any).contains(event.target)
      ) {
        setMoreDropdownOpen(false);
      }

      if (
        userDropdownRef.current &&
        !(userDropdownRef.current as any).contains(event.target)
      ) {
        setUserDropdownOpen(false);
      }

      if (
        searchBarRef.current &&
        !(searchBarRef.current as any).contains(event.target)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on ESC key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, []);

  // Toggle functions
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const toggleSearch = () => setSearchOpen(!searchOpen);
  const toggleMoreDropdown = () => setMoreDropdownOpen(!moreDropdownOpen);
  const toggleUserDropdown = () => setUserDropdownOpen(!userDropdownOpen);

  // Handle user menu item click
  const handleUserMenuItemClick = (
    e: React.MouseEvent,
    href: string,
    callback?: () => void,
  ) => {
    e.preventDefault();
    setUserDropdownOpen(false);
    if (callback) callback();
  };

  // Navigation items
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/features", label: "Alpha features", icon: Sparkles },
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
    { href: "/groups", label: "Groups", icon: Users, requiresAuth: true },
  ];

  const moreItems = [
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      requiresAuth: true,
    },
    {
      href: "/customize",
      label: "Customize",
      icon: Palette,
      requiresAuth: true,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      requiresAuth: true,
    },
  ];

  // Filter items based on auth status
  const filteredNavItems = navItems.filter(
    (item) => !item.requiresAuth || (item.requiresAuth && isAuthenticated),
  );

  const filteredMoreItems = moreItems.filter(
    (item) => !item.requiresAuth || (item.requiresAuth && isAuthenticated),
  );

  return {
    isScrolled,
    mobileMenuOpen,
    searchOpen,
    moreDropdownOpen,
    userDropdownOpen,
    toggleMobileMenu,
    toggleSearch,
    toggleMoreDropdown,
    toggleUserDropdown,
    handleUserMenuItemClick,
    moreDropdownRef,
    userDropdownRef,
    mobileMenuRef,
    searchBarRef,
    filteredNavItems,
    filteredMoreItems,
  };
};
