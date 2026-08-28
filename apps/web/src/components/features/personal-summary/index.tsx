"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@convolens/contexts";
import { PersonalSummaryCard } from "../../common/personal-summary-card";
import styles from "./personal-summary.module.css";

function PersonalSummary() {
  const { personalSummaries, topGroups } = useApp();
  const [searchTerm, setSearchTerm] = useState("");

  const visibleSummaries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return [...personalSummaries]
      .filter(
        (summary) =>
          !query ||
          summary.content.toLowerCase().includes(query) ||
          summary.highlights.some((highlight) =>
            highlight.toLowerCase().includes(query),
          ),
      )
      .sort(
        (left, right) =>
          new Date(right.date).getTime() - new Date(left.date).getTime(),
      );
  }, [personalSummaries, searchTerm]);

  const totalMessages = personalSummaries.reduce(
    (total, summary) => total + summary.messageCount,
    0,
  );

  return (
    <div className={styles.personalSummary}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>Personal summaries</h1>
            <p className={styles.subtitle}>
              Review your generated conversation summaries.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.totalCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{personalSummaries.length}</div>
            <div className={styles.statLabel}>Summaries</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.activeCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{totalMessages}</div>
            <div className={styles.statLabel}>Messages represented</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.weekCard}`}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{topGroups.length}</div>
            <div className={styles.statLabel}>Active groups</div>
          </div>
        </div>
      </div>

      <div className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="search"
              placeholder="Search summaries..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={`${styles.summariesContainer} ${styles.grid}`}>
        {visibleSummaries.length > 0 ? (
          visibleSummaries.map((summary) => (
            <PersonalSummaryCard key={summary.id} summary={summary} />
          ))
        ) : (
          <div className={styles.emptyState}>
            <Search size={48} />
            <h2 className={styles.emptyTitle}>No summaries found</h2>
            <p className={styles.emptyDescription}>
              Try a different search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonalSummary;
