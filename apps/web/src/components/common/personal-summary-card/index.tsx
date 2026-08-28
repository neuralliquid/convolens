"use client";

import type { PersonalSummary } from "@convolens/contexts";
import styles from "./personal-summary-card.module.css";

interface PersonalSummaryCardProps {
  summary: PersonalSummary;
}

export function PersonalSummaryCard({ summary }: PersonalSummaryCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>
            {new Date(summary.date).toLocaleDateString()}
          </h3>
          <p className={styles.dateRange}>{summary.messageCount} messages</p>
        </div>
        <div className={`${styles.status} ${styles.statusGenerated}`}>
          <span className={styles.statusText}>{summary.sentiment}</span>
        </div>
      </div>

      <p>{summary.content}</p>

      {summary.highlights.length > 0 ? (
        <div className={styles.insights}>
          <h4 className={styles.sectionTitle}>Highlights</h4>
          <ul className={styles.insightsList}>
            {summary.highlights.map((highlight) => (
              <li key={highlight} className={styles.insightItem}>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
