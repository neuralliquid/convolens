"use client";

import {
  Clock,
  Download,
  Eye,
  Filter,
  Grid,
  List,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./groups.module.css";

interface Group {
  id: string;
  name: string;
  type: "family" | "friends" | "work" | "other";
  memberCount: number;
  messageCount: number;
  lastActivity: string;
  avatar: string;
  description: string;
  isActive: boolean;
  priority: "high" | "medium" | "low";
  summaryCount: number;
  engagement: number;
  tags: string[];
}

const mockGroups: Group[] = [
  {
    id: "1",
    name: "Family Chat",
    type: "family",
    memberCount: 8,
    messageCount: 2456,
    lastActivity: "2 hours ago",
    avatar: "/placeholder.svg?height=60&width=60",
    description: "Our lovely family group where we share updates and memories",
    isActive: true,
    priority: "high",
    summaryCount: 15,
    engagement: 92,
    tags: ["daily", "important", "photos"],
  },
  {
    id: "2",
    name: "College Friends",
    type: "friends",
    memberCount: 12,
    messageCount: 5678,
    lastActivity: "1 day ago",
    avatar: "/placeholder.svg?height=60&width=60",
    description: "Reconnecting with old college buddies and planning reunions",
    isActive: true,
    priority: "medium",
    summaryCount: 8,
    engagement: 76,
    tags: ["reunion", "memories", "events"],
  },
  {
    id: "3",
    name: "Work Team",
    type: "work",
    memberCount: 6,
    messageCount: 1234,
    lastActivity: "3 hours ago",
    avatar: "/placeholder.svg?height=60&width=60",
    description: "Daily standup and project coordination discussions",
    isActive: false,
    priority: "high",
    summaryCount: 22,
    engagement: 88,
    tags: ["project", "deadlines", "meetings"],
  },
  {
    id: "4",
    name: "Book Club",
    type: "other",
    memberCount: 15,
    messageCount: 890,
    lastActivity: "1 week ago",
    avatar: "/placeholder.svg?height=60&width=60",
    description: "Monthly book discussions and reading recommendations",
    isActive: true,
    priority: "low",
    summaryCount: 4,
    engagement: 45,
    tags: ["books", "monthly", "discussion"],
  },
  {
    id: "5",
    name: "Neighborhood Watch",
    type: "other",
    memberCount: 25,
    messageCount: 456,
    lastActivity: "2 days ago",
    avatar: "/placeholder.svg?height=60&width=60",
    description: "Community safety updates and local event coordination",
    isActive: false,
    priority: "medium",
    summaryCount: 3,
    engagement: 34,
    tags: ["safety", "community", "alerts"],
  },
  {
    id: "6",
    name: "Gaming Squad",
    type: "friends",
    memberCount: 7,
    messageCount: 3421,
    lastActivity: "30 minutes ago",
    avatar: "/placeholder.svg?height=60&width=60",
    description: "Coordinating game sessions and sharing gaming tips",
    isActive: true,
    priority: "medium",
    summaryCount: 12,
    engagement: 95,
    tags: ["gaming", "tournaments", "tips"],
  },
];

const typeColors = {
  family: { primary: "#ef4444", secondary: "#fef2f2", accent: "#dc2626" },
  friends: { primary: "#3b82f6", secondary: "#eff6ff", accent: "#2563eb" },
  work: { primary: "#8b5cf6", secondary: "#f5f3ff", accent: "#7c3aed" },
  other: { primary: "#10b981", secondary: "#ecfdf5", accent: "#059669" },
};

const priorityColors = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

const typeIcons = {
  family: "👨‍👩‍👧‍👦",
  friends: "👥",
  work: "💼",
  other: "🌟",
};

export function Groups() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<
    "name" | "activity" | "engagement" | "messages"
  >("activity");
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const filteredAndSortedGroups = useMemo(() => {
    const filtered = mockGroups.filter((group) => {
      const matchesSearch =
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      const matchesType = selectedType === "all" || group.type === selectedType;
      const matchesPriority =
        selectedPriority === "all" || group.priority === selectedPriority;
      return matchesSearch && matchesType && matchesPriority;
    });

    // Sort groups
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "engagement":
          return b.engagement - a.engagement;
        case "messages":
          return b.messageCount - a.messageCount;
        case "activity":
        default:
          // Convert activity to sortable format
          const getActivityScore = (activity: string) => {
            if (activity.includes("minutes")) return 1000;
            if (activity.includes("hour"))
              return Number.parseInt(activity) || 100;
            if (activity.includes("day"))
              return (Number.parseInt(activity) || 1) * 24;
            if (activity.includes("week"))
              return (Number.parseInt(activity) || 1) * 168;
            return 999;
          };
          return (
            getActivityScore(a.lastActivity) - getActivityScore(b.lastActivity)
          );
      }
    });

    return filtered;
  }, [searchTerm, selectedType, selectedPriority, sortBy]);

  const handleGroupSelect = useCallback((groupId: string) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  const handleBulkAction = useCallback(
    (action: string) => {
      console.log(
        `Performing ${action} on groups:`,
        Array.from(selectedGroups),
      );
      // Implement bulk actions here
      setSelectedGroups(new Set());
    },
    [selectedGroups],
  );

  const getTypeColor = (type: Group["type"]) => typeColors[type];
  const getPriorityColor = (priority: Group["priority"]) =>
    priorityColors[priority];

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className={styles.groupsContainer}>
        {/* Enhanced Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleSection}>
              <div className={styles.iconContainer}>
                <Users className={styles.headerIcon} />
                <div className={styles.iconGlow}></div>
              </div>
              <div className={styles.titleContent}>
                <h1 className={styles.title}>Groups</h1>
                <p className={styles.subtitle}>
                  Manage and analyze your WhatsApp group conversations
                </p>
                <div className={styles.statsRow}>
                  <span className={styles.statBadge}>
                    {mockGroups.length} Total Groups
                  </span>
                  <span className={styles.statBadge}>
                    {mockGroups.filter((g) => g.isActive).length} Active
                  </span>
                  <span className={styles.statBadge}>
                    {mockGroups.reduce((sum, g) => sum + g.summaryCount, 0)}{" "}
                    Summaries
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button className={styles.primaryButton}>
                <Plus className={styles.buttonIcon} />
                <span>Add Group</span>
              </button>
              <button className={styles.secondaryButton}>
                <TrendingUp className={styles.buttonIcon} />
                <span>Analytics</span>
              </button>
              <button className={styles.secondaryButton}>
                <Settings className={styles.buttonIcon} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Search and Filters */}
        <div className={styles.searchSection}>
          <div className={styles.searchContainer}>
            <div className={styles.searchRow}>
              <div className={styles.searchInputWrapper}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search groups, descriptions, or tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                {searchTerm && (
                  <button
                    className={styles.clearSearch}
                    onClick={() => setSearchTerm("")}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className={styles.quickFilters}>
                <button
                  className={`${styles.quickFilter} ${selectedType === "all" ? styles.active : ""}`}
                  onClick={() => setSelectedType("all")}
                >
                  All
                </button>
                <button
                  className={`${styles.quickFilter} ${selectedType === "family" ? styles.active : ""}`}
                  onClick={() => setSelectedType("family")}
                >
                  👨‍👩‍👧‍👦 Family
                </button>
                <button
                  className={`${styles.quickFilter} ${selectedType === "friends" ? styles.active : ""}`}
                  onClick={() => setSelectedType("friends")}
                >
                  👥 Friends
                </button>
                <button
                  className={`${styles.quickFilter} ${selectedType === "work" ? styles.active : ""}`}
                  onClick={() => setSelectedType("work")}
                >
                  💼 Work
                </button>
              </div>
            </div>

            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <Filter className={styles.filterIcon} />
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className={styles.filterSelect}
                  aria-label="Filter by priority"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={styles.filterSelect}
                  aria-label="Sort groups by"
                >
                  <option value="activity">Recent Activity</option>
                  <option value="name">Name</option>
                  <option value="engagement">Engagement</option>
                  <option value="messages">Message Count</option>
                </select>
              </div>

              <div className={styles.viewControls}>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewButton} ${viewMode === "grid" ? styles.viewButtonActive : ""}`}
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                  >
                    <Grid className={styles.viewIcon} />
                  </button>
                  <button
                    className={`${styles.viewButton} ${viewMode === "list" ? styles.viewButtonActive : ""}`}
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <List className={styles.viewIcon} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.resultsInfo}>
            <span className={styles.resultsCount}>
              {filteredAndSortedGroups.length} group
              {filteredAndSortedGroups.length !== 1 ? "s" : ""} found
            </span>

            {selectedGroups.size > 0 && (
              <div className={styles.bulkActions}>
                <span className={styles.selectedCount}>
                  {selectedGroups.size} selected
                </span>
                <button
                  className={styles.bulkButton}
                  onClick={() => handleBulkAction("summarize")}
                >
                  <Zap size={14} />
                  Bulk Summarize
                </button>
                <button
                  className={styles.bulkButton}
                  onClick={() => handleBulkAction("export")}
                >
                  <Download size={14} />
                  Export
                </button>
                <button
                  className={styles.bulkButton}
                  onClick={() => handleBulkAction("share")}
                >
                  <Share2 size={14} />
                  Share
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Groups Grid/List */}
        <div
          className={`${styles.groupsGrid} ${viewMode === "list" ? styles.groupsList : ""}`}
        >
          {filteredAndSortedGroups.map((group) => (
            <div
              key={group.id}
              className={`${styles.groupCard} ${selectedGroups.has(group.id) ? styles.selected : ""}`}
              onClick={() => handleGroupSelect(group.id)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.groupAvatar}>
                  <Image
                    src={group.avatar || "/placeholder.svg"}
                    alt={group.name}
                    width={48}
                    height={48}
                    className={styles.avatarImage}
                  />
                  <div
                    className={`${styles.typeIndicator} ${styles[`typeIndicator${group.type.charAt(0).toUpperCase() + group.type.slice(1)}`]}`}
                  >
                    <span className={styles.typeEmoji}>
                      {typeIcons[group.type]}
                    </span>
                  </div>
                  {group.isActive && (
                    <div className={styles.activeIndicator}></div>
                  )}
                  <div
                    className={`${styles.priorityIndicator} ${styles[`priorityIndicator${group.priority.charAt(0).toUpperCase() + group.priority.slice(1)}`]}`}
                  ></div>
                </div>

                <div className={styles.groupInfo}>
                  <div className={styles.groupHeader}>
                    <h3 className={styles.groupName}>{group.name}</h3>
                    <div className={styles.engagementBadge}>
                      <Star size={12} />
                      {group.engagement}%
                    </div>
                  </div>
                  <p className={styles.groupDescription}>{group.description}</p>
                  <div className={styles.groupTags}>
                    {group.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={styles.tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.cardMenu}>
                  <button
                    className={styles.menuButton}
                    aria-label="More options"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>

              <div className={styles.cardStats}>
                <div className={styles.statItem}>
                  <Users className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <span className={styles.statValue}>
                      {group.memberCount}
                    </span>
                    <span className={styles.statLabel}>Members</span>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <MessageSquare className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <span className={styles.statValue}>
                      {group.messageCount.toLocaleString()}
                    </span>
                    <span className={styles.statLabel}>Messages</span>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <TrendingUp className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <span className={styles.statValue}>
                      {group.summaryCount}
                    </span>
                    <span className={styles.statLabel}>Summaries</span>
                  </div>
                </div>
                <div className={styles.statItem}>
                  <Clock className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <span className={styles.statValue}>
                      {group.lastActivity}
                    </span>
                    <span className={styles.statLabel}>Last Active</span>
                  </div>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button className={styles.actionButton}>
                  <Eye size={16} />
                  <span>View</span>
                </button>
                <button className={styles.actionButton}>
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
                <button className={styles.primaryActionButton}>
                  <Zap size={16} />
                  <span>Summarize</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredAndSortedGroups.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Users className={styles.emptyIconSvg} />
            </div>
            <h3 className={styles.emptyTitle}>No groups found</h3>
            <p className={styles.emptyDescription}>
              {searchTerm ||
              selectedType !== "all" ||
              selectedPriority !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Start by adding your first WhatsApp group"}
            </p>
            <button className={styles.emptyAction}>
              <Plus className={styles.buttonIcon} />
              <span>Add Your First Group</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
