import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownButtonProps } from '../../types';
import styles from '../../navigation.module.css';

export const DropdownButton = ({
  isOpen,
  children,
  className,
  onClick,
  onKeyDown,
  id,
}: DropdownButtonProps) => (
  <button
    id={id}
    type="button"
    className={cn(styles.dropdownButton, className, {
      [styles.dropdownOpen]: isOpen,
    })}
    onClick={onClick}
    onKeyDown={onKeyDown}
    aria-expanded={isOpen}
    aria-haspopup="true"
  >
    {children}
    <ChevronDown
      className={cn(styles.dropdownIcon, {
        [styles.dropdownIconOpen]: isOpen,
      })}
      aria-hidden="true"
    />
  </button>
);

export default DropdownButton;
