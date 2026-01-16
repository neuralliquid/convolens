import * as React from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchBarProps } from '../../types';
import styles from '../../navigation.module.css';

const { useState } = React;

export const SearchBar = ({
  isOpen,
  onClose,
  onSearch,
  className,
}: SearchBarProps & { className?: string }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  if (!isOpen) return null;

  return (
    <div className={cn(styles.searchModal, className)}>
      <div className={styles.searchModalContent}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchInputContainer}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className={styles.searchInput}
              autoFocus
              aria-label="Search"
            />
            <button
              type="button"
              className={styles.closeSearchButton}
              onClick={onClose}
              aria-label="Close search"
            >
              <X className={styles.icon} />
            </button>
          </div>
        </form>
        <div className={styles.searchResults}>
          {/* Search results will be rendered here */}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
