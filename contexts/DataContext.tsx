'use client';

import React, { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { getSections, getTransactions, getPersons, getVaultItems } from '@/lib/firestore';
import type { Section, Transaction, Person, VaultItem } from '@/lib/types';

interface DataContextType {
  sections: Section[];
  transactions: Transaction[];
  persons: Person[];
  vault: VaultItem[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  refreshTransactions: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const { data: sections, isLoading: sLoading, error: sError, mutate: mSections } = useSWR(
    user ? `sections-${user.uid}` : null,
    () => getSections(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { data: txResult, isLoading: tLoading, error: tError, mutate: mTransactions } = useSWR(
    user ? `transactions-${user.uid}` : null,
    () => getTransactions(user?.uid || '', 50),
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: persons, isLoading: pLoading, error: pError, mutate: mPersons } = useSWR(
    user ? `persons-${user.uid}` : null,
    () => getPersons(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { data: vault, isLoading: vLoading, error: vError, mutate: mVault } = useSWR(
    user ? `vault-${user.uid}` : null,
    () => getVaultItems(user?.uid || ''),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const value = useMemo(() => ({
    sections: sections || [],
    transactions: txResult?.data || [],
    persons: persons || [],
    vault: vault || [],
    loading: (sLoading || tLoading || pLoading || vLoading) && !sections && !txResult && !persons && !vault,
    error: sError || tError || pError || vError || null,
    refresh: () => {
      mSections();
      mTransactions();
      mPersons();
      mVault();
    },
    refreshTransactions: mTransactions
  }), [sections, txResult, persons, vault, sLoading, tLoading, pLoading, vLoading, sError, tError, pError, vError, mSections, mTransactions, mPersons, mVault]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
