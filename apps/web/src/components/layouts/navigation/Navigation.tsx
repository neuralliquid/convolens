"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@convolens/contexts";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Menu, User, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useNavigation } from "./hooks/useNavigation";
import styles from "./navigation.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  requiresAuth?: boolean;
  onClick?: (e: React.MouseEvent) => void | Promise<void>;
};

type NavLinkProps = {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  className?: string;
};

const NavLink = ({ item, isActive, onClick, className = "" }: NavLinkProps) => {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(styles.navLink, isActive && styles.active, className)}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={styles.navIcon} />
      <span>{item.label}</span>
    </Link>
  );
};

const MobileNavLink = ({
  item,
  isActive,
  onClick,
  className = "",
}: NavLinkProps) => {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(styles.mobileNavLink, isActive && styles.active, className)}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={styles.mobileNavIcon} />
      <span>{item.label}</span>
    </Link>
  );
};

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const {
    isScrolled,
    mobileMenuOpen,
    userDropdownOpen,
    toggleMobileMenu,
    closeMobileMenu,
    toggleUserDropdown,
    handleUserMenuItemClick,
    userDropdownRef,
    mobileMenuRef,
    filteredNavItems,
  } = useNavigation(isAuthenticated);

  const userMenuItems = [
    {
      href: "#",
      label: "Sign out",
      icon: LogOut,
      onClick: async (e: React.MouseEvent) => {
        e.preventDefault();
        try {
          // Use the logout function from the auth context
          if (typeof window !== "undefined") {
            await logout();
            router.push("/");
          }
        } catch (error) {
          console.error("Error during logout:", error);
          // Fallback to a full page reload if there's an error
          window.location.href = "/";
        }
      },
    },
  ];

  return (
    <>
      <nav
        className={cn(styles.nav, {
          [styles.scrolled]: isScrolled,
          [styles.mobileMenuOpen]: mobileMenuOpen,
        })}
        ref={mobileMenuRef as React.RefObject<HTMLDivElement>}
      >
        <div className={styles.container}>
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className={styles.mobileMenuButton}
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>

          {/* Logo */}
          <div className={styles.logo}>
            <Link href="/" className={styles.logoLink}>
              <span className={styles.logoText}>ConvoLens</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className={styles.desktopNav}>
            <ul className={styles.navList}>
              {filteredNavItems.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    isActive={pathname === item.href}
                    onClick={closeMobileMenu}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* User Actions */}
          <div className={styles.actions}>
            {/* Theme Toggle */}
            <div className={styles.themeToggle}>
              <ThemeToggle />
            </div>

            {isAuthenticated ? (
              <div
                className={styles.dropdown}
                ref={userDropdownRef as React.RefObject<HTMLDivElement>}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        styles.userButton,
                        userDropdownOpen && styles.active,
                      )}
                      onClick={toggleUserDropdown}
                      aria-expanded={userDropdownOpen}
                      aria-haspopup="true"
                    >
                      <User className={styles.userIcon} />
                      <span className={styles.userName}>
                        {user?.name || "Account"}
                      </span>
                      <ChevronDown
                        className={cn(styles.dropdownIcon, {
                          [styles.dropdownIconOpen]: userDropdownOpen,
                        })}
                        aria-hidden="true"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {userMenuItems.map((item) => (
                      <DropdownMenuItem
                        key={item.href}
                        onClick={(e) => {
                          handleUserMenuItemClick(e, () => {
                            if (item.onClick) {
                              item.onClick(e);
                            }
                          });
                        }}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className={styles.authButtons}>
                <Link
                  href="/login"
                  className={cn(styles.button, styles.signupButton)}
                  onClick={closeMobileMenu}
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(styles.mobileMenu, { [styles.open]: mobileMenuOpen })}
          aria-hidden={!mobileMenuOpen}
        >
          <div className={styles.mobileMenuContent}>
            <nav>
              <ul className={styles.mobileNavList}>
                {filteredNavItems.map((item) => (
                  <li key={item.href}>
                    <MobileNavLink
                      item={item}
                      isActive={pathname === item.href}
                      onClick={closeMobileMenu}
                    />
                  </li>
                ))}
              </ul>
            </nav>

            {!isAuthenticated && (
              <div className={styles.mobileAuthButtons}>
                <Link
                  href="/login"
                  className={cn(styles.button, styles.signupButton)}
                  onClick={closeMobileMenu}
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
