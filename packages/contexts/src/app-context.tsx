"use client"

import { createContext, useContext, ReactNode, useCallback, useState } from 'react';

export interface Group {
  id: string;
  name: string;
  platform: Platform;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isPinned?: boolean;
}

export interface Summary {
  id: string;
  groupId: string;
  date: string;
  content: string;
  highlights: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  wordCount: number;
  messageCount: number;
}

export interface PersonalSummary {
  id: string;
  date: string;
  content: string;
  highlights: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  wordCount: number;
  messageCount: number;
}

export interface TopGroup {
  id: string;
  name: string;
  messageCount: number;
  change: number; // percentage
}

export type Platform = 'whatsapp' | 'telegram' | 'signal' | 'messenger' | 'slack' | 'discord';

export interface CrossPlatformGroup {
  id: string;
  name: string;
  platform: Platform;
  memberCount: number;
  isActive: boolean;
}

export interface AppContextType {
  // Groups
  groups: Group[];
  activeGroup: Group | null;
  setActiveGroup: (group: Group | null) => void;
  
  // Summaries
  summaries: Summary[];
  personalSummaries: PersonalSummary[];
  
  // Analytics
  topGroups: TopGroup[];
  crossPlatformGroups: CrossPlatformGroup[];
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  refreshData: () => Promise<void>;
  generateSummary: (groupId: string, dateRange: { start: string; end: string }) => Promise<Summary>;
  updateGroup: (groupId: string, updates: Partial<Group>) => void;
  deleteGroup: (groupId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data
const mockGroups: Group[] = [
  {
    id: '1',
    name: 'Family Group',
    platform: 'whatsapp',
    unreadCount: 3,
    lastMessage: 'See you tomorrow!',
    lastMessageTime: '10:30 AM',
    isPinned: true,
  },
  {
    id: '2',
    name: 'Work Team',
    platform: 'slack',
    unreadCount: 0,
    lastMessage: 'Meeting at 2 PM',
    lastMessageTime: 'Yesterday',
    isPinned: true,
  },
  {
    id: '3',
    name: 'Gaming Buddies',
    platform: 'discord',
    unreadCount: 12,
    lastMessage: 'GG everyone!',
    lastMessageTime: '2h ago',
    isPinned: false,
  },
];

const mockSummaries: Summary[] = [
  {
    id: 's1',
    groupId: '1',
    date: '2023-06-15',
    content: 'The family discussed weekend plans and decided to go hiking on Saturday.',
    highlights: [
      'Weekend hiking trip planned',
      'Dinner at 7 PM on Sunday',
      'Mom will bring the dessert'
    ],
    sentiment: 'positive',
    wordCount: 45,
    messageCount: 23,
  },
];

const mockPersonalSummaries: PersonalSummary[] = [
  {
    id: 'ps1',
    date: '2023-06-15',
    content: 'You had active conversations in 3 different groups today.',
    highlights: [
      'Discussed project deadline in Work Team',
      'Planned weekend trip with Family Group',
      'Shared photos from vacation'
    ],
    sentiment: 'neutral',
    wordCount: 120,
    messageCount: 56,
  },
];

const mockTopGroups: TopGroup[] = [
  { id: '1', name: 'Family Group', messageCount: 342, change: 12 },
  { id: '2', name: 'Work Team', messageCount: 278, change: -5 },
  { id: '3', name: 'Gaming Buddies', messageCount: 156, change: 23 },
];

const mockCrossPlatformGroups: CrossPlatformGroup[] = [
  { id: '1', name: 'Family Group', platform: 'whatsapp', memberCount: 8, isActive: true },
  { id: '2', name: 'Work Team', platform: 'slack', memberCount: 15, isActive: true },
  { id: '3', name: 'Gaming Buddies', platform: 'discord', memberCount: 6, isActive: true },
  { id: '4', name: 'College Friends', platform: 'telegram', memberCount: 12, isActive: false },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>(mockSummaries);
  // @ts-ignore - setPersonalSummaries is unused for now
  const [personalSummaries, setPersonalSummaries] = useState<PersonalSummary[]>(mockPersonalSummaries);
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // In a real app, you would fetch data from your API
      // const data = await api.get('/data');
      // setGroups(data.groups);
      // setSummaries(data.summaries);
      // etc.
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to refresh data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateSummary = useCallback(async (groupId: string, dateRange: { start: string; end: string }) => {
    setIsLoading(true);
    try {
      // In a real app, you would call your API to generate a summary
      // const response = await api.post('/summaries/generate', { groupId, ...dateRange });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newSummary: Summary = {
        id: `s${Date.now()}`,
        groupId,
        date: new Date().toISOString().split('T')[0] || new Date().toISOString(),
        content: `Generated summary for ${dateRange.start} to ${dateRange.end}. This is a placeholder summary.`,
        highlights: [
          'Highlight 1 from generated summary',
          'Highlight 2 from generated summary',
          'Highlight 3 from generated summary'
        ],
        sentiment: 'positive',
        wordCount: 150,
        messageCount: 42,
      };
      
      setSummaries(prev => [...prev, newSummary]);
      return newSummary;
    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateGroup = useCallback((groupId: string, updates: Partial<Group>) => {
    setGroups(prev => 
      prev.map(group => 
        group.id === groupId ? { ...group, ...updates } : group
      )
    );
    
    if (activeGroup?.id === groupId) {
      setActiveGroup(prev => (prev ? { ...prev, ...updates } : null));
    }
  }, [activeGroup]);

  const deleteGroup = useCallback(async (groupId: string) => {
    setIsLoading(true);
    try {
      // In a real app, you would call your API to delete the group
      // await api.delete(`/groups/${groupId}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setGroups(prev => prev.filter(group => group.id !== groupId));
      
      if (activeGroup?.id === groupId) {
        setActiveGroup(null);
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [activeGroup]);

  const value = {
    groups,
    activeGroup,
    setActiveGroup,
    summaries,
    personalSummaries,
    topGroups: mockTopGroups,
    crossPlatformGroups: mockCrossPlatformGroups,
    isLoading,
    refreshData,
    generateSummary,
    updateGroup,
    deleteGroup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
