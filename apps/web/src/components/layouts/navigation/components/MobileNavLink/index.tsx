import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MobileNavLinkProps } from '../../types';
import styles from '../../navigation.module.css';

export const MobileNavLink = ({
  item,
  isActive,
  className = '',
  onClick
}: MobileNavLinkProps) => {
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      className={cn(
        styles.mobileNavLink,
        isActive && styles.active,
        className
      )}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className={styles.mobileNavIcon} />
      <span>{item.label}</span>
      {item.shortcut && (
        <span className={styles.shortcut}>
          {item.shortcut}
        </span>
      )}
    </Link>
  );
};

export default MobileNavLink;
