"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./admin.module.css";

interface SystemStats {
  totalUsers: number;
  activeSummaries: number;
  totalGroups: number;
  systemUptime: string;
}

const mockStats: SystemStats = {
  totalUsers: 1247,
  activeSummaries: 3892,
  totalGroups: 567,
  systemUptime: "99.9%",
};

function Admin() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "settings" | "logs"
  >("overview");
  const [stats] = useState<SystemStats>(mockStats);

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className={styles.overview}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>👥</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statValue}>
                    {stats.totalUsers.toLocaleString()}
                  </h3>
                  <p className={styles.statLabel}>Total Users</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>📝</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statValue}>
                    {stats.activeSummaries.toLocaleString()}
                  </h3>
                  <p className={styles.statLabel}>Active Summaries</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>💬</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statValue}>
                    {stats.totalGroups.toLocaleString()}
                  </h3>
                  <p className={styles.statLabel}>Total Groups</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>⚡</div>
                <div className={styles.statInfo}>
                  <h3 className={styles.statValue}>{stats.systemUptime}</h3>
                  <p className={styles.statLabel}>System Uptime</p>
                </div>
              </div>
            </div>
          </div>
        );
      case "users":
        return (
          <div className={styles.users}>
            <div className={styles.usersList}>
              <div className={styles.userItem}>
                <div className={styles.userInfo}>
                  <Image
                    src="/placeholder-user.jpg"
                    alt="User"
                    width={40}
                    height={40}
                    className={styles.userAvatar}
                  />
                  <div>
                    <h4 className={styles.userName}>John Doe</h4>
                    <p className={styles.userEmail}>john@example.com</p>
                  </div>
                </div>
                <div className={styles.userActions}>
                  <button className={styles.actionBtn}>Edit</button>
                  <button className={styles.actionBtn}>Disable</button>
                </div>
              </div>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className={styles.settings}>
            <div className={styles.settingGroup}>
              <h3 className={styles.settingTitle}>System Configuration</h3>
              <div className={styles.settingItem}>
                <label htmlFor="maxSummaries" className={styles.settingLabel}>
                  Max Summaries Per User
                </label>
                <input
                  id="maxSummaries"
                  type="number"
                  defaultValue="10"
                  className={styles.settingInput}
                  aria-label="Maximum number of summaries allowed per user"
                />
              </div>
              <div className={styles.settingItem}>
                <label
                  htmlFor="summaryRetention"
                  className={styles.settingLabel}
                >
                  Summary Retention (days)
                </label>
                <input
                  id="summaryRetention"
                  type="number"
                  defaultValue="30"
                  className={styles.settingInput}
                  aria-label="Number of days to retain summaries"
                />
              </div>
            </div>
          </div>
        );
      case "logs":
        return (
          <div className={styles.logs}>
            <div className={styles.logsList}>
              <div className={styles.logItem}>
                <span className={styles.logTime}>2024-01-15 10:30:00</span>
                <span className={styles.logLevel}>INFO</span>
                <span className={styles.logMessage}>
                  User john@example.com created new summary
                </span>
              </div>
              <div className={styles.logItem}>
                <span className={styles.logTime}>2024-01-15 10:25:00</span>
                <span className={styles.logLevel}>ERROR</span>
                <span className={styles.logMessage}>
                  Failed to send email notification
                </span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.subtitle}>
            System administration and monitoring
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab("overview")}
            className={`${styles.tab} ${activeTab === "overview" ? styles.active : ""}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`${styles.tab} ${activeTab === "users" ? styles.active : ""}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`${styles.tab} ${activeTab === "settings" ? styles.active : ""}`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`${styles.tab} ${activeTab === "logs" ? styles.active : ""}`}
          >
            Logs
          </button>
        </div>

        <div className={styles.content}>{renderTabContent()}</div>
      </div>
    </div>
  );
}

export default Admin;
