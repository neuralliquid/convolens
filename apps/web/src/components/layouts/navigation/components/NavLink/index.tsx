import Link from 'next/link';
import { cn } from '@/lib/utils';
import { NavLinkProps } from '../../types';
import styles from '../../navigation.module.css';

export const NavLink = ({
  item,
  isActive,
  className = '',
  onClick
}: NavLinkProps) => {
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      className={cn(
        styles.navLink,
        isActive && styles.active,
        className
      )}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className={styles.navIcon} />
      <span>{item.label}</span>
      {item.shortcut && (
        <span className={styles.shortcut}>
          {item.shortcut}
        </span>
      )}
    </Link>
  );
};

export default NavLink;
