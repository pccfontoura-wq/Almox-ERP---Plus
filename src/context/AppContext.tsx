import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Branch, User } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from './AuthContext';

interface AppContextType {
  selectedBranch: Branch | 'GLOBAL';
  setSelectedBranch: (branch: Branch | 'GLOBAL') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  refreshData: () => void;
  dataVersion: number;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected Branch initialization
  const [selectedBranch, setSelectedBranchState] = useState<Branch | 'GLOBAL'>(() => {
    if (currentUser?.role === 'Master') return 'GLOBAL';
    return currentUser?.branch || 'SP';
  });

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'Regular' || currentUser.role === 'Visitante') {
        setSelectedBranchState(currentUser.branch);
      } else if (currentUser.role === 'Master') {
        // Keep selectedBranch if Master
      }
    }
  }, [currentUser]);

  const setSelectedBranch = (branch: Branch | 'GLOBAL') => {
    if (currentUser?.role === 'Regular' || currentUser?.role === 'Visitante') {
      // Force lock to user's assigned branch
      setSelectedBranchState(currentUser.branch);
    } else {
      setSelectedBranchState(branch);
    }
  };

  const refreshData = useCallback(() => {
    setDataVersion(prev => prev + 1);
  }, []);

  useEffect(() => {
    const unsubscribe = dataService.subscribe(() => {
      setDataVersion(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  return (
    <AppContext.Provider value={{
      selectedBranch,
      setSelectedBranch,
      searchTerm,
      setSearchTerm,
      refreshData,
      dataVersion
    }}>
      {children}
    </AppContext.Provider>
  );
};
