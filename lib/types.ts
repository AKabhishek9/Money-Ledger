// ===== TABS =====
export type TabType = 'personal' | 'people' | 'vault' | 'custom';

export interface Tab {
  id: string;
  userId: string;
  name: string;
  type: TabType;
  icon: string;
  order: number;
  pinned: boolean;
  archived: boolean;
  isSystem: boolean;
  createdAt: Date;
}

// ===== WINDOWS / PAGES =====
export interface MoneyWindow {
  id: string;
  userId: string;
  tabId: string;
  title: string;
  order: number;
  pinned: boolean;
  archived: boolean;
  inRecycleBin: boolean;
  autoMonthly: boolean;
  monthKey?: string;
  createdAt: Date;
}

// ===== ENTRIES =====
export type EntryType = 'add' | 'subtract' | 'expression';

export interface Entry {
  id: string;
  userId: string;
  windowId: string;
  rawText: string;
  amount: number; // positive or negative, calculated
  note: string;
  type: EntryType;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  linkedPersonId?: string;
  linkedPersonName?: string;
}

// ===== PARSED ENTRY =====
export interface ParsedEntry {
  amount: number;
  note: string;
  type: EntryType;
  rawText: string;
  isValid: boolean;
  error?: string;
}

// ===== PERSONS =====
export interface Person {
  id: string;
  userId: string;
  name: string;
  note: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ===== PERSON ENTRIES =====
export interface PersonEntry {
  id: string;
  userId: string;
  personId: string;
  rawText: string;
  amount: number; // positive = they owe you, negative = you owe them
  note: string;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  linkedEntryId?: string;
  linkedWindowId?: string;
}

// ===== VAULT =====
export type VaultType = 'bank' | 'card' | 'note' | 'aadhaar' | 'pan';

export interface VaultItem {
  id: string;
  userId: string;
  type: VaultType;
  title: string;
  fields: Record<string, string>; // key-value pairs
  createdAt: Date;
  updatedAt: Date;
}

// ===== VAULT TEMPLATES =====
export const VAULT_TEMPLATES: Record<VaultType, { label: string; icon: string; fields: string[] }> = {
  bank: {
    label: 'Bank Account',
    icon: '🏦',
    fields: ['Bank Name', 'Account Number', 'IFSC Code', 'Branch', 'Account Holder'],
  },
  card: {
    label: 'Card',
    icon: '💳',
    fields: ['Card Type', 'Card Number', 'Expiry', 'CVV', 'Card Holder'],
  },
  note: {
    label: 'Secure Note',
    icon: '📝',
    fields: ['Content'],
  },
  aadhaar: {
    label: 'Aadhaar',
    icon: '🪪',
    fields: ['Aadhaar Number', 'Name', 'DOB', 'Address'],
  },
  pan: {
    label: 'PAN Card',
    icon: '📄',
    fields: ['PAN Number', 'Name', 'DOB'],
  },
};

// ===== USER =====
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
