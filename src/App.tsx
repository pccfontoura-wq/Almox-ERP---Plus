import React, { useState } from 'react';
import { Box } from '@mui/material';

import { ThemeContextProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { FirstAccessModal } from './components/FirstAccessModal';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Almoxarifado } from './pages/Almoxarifado';
import { Compras } from './pages/Compras';
import { Patrimonio } from './pages/Patrimonio';
import { Inventario } from './pages/Inventario';
import { CentroDeCustos } from './pages/CentroDeCustos';
import { Unidades } from './pages/Unidades';
import { Relatorios } from './pages/Relatorios';
import { Indicadores } from './pages/Indicadores';
import { AssistenteIA } from './pages/AssistenteIA';
import { Administracao } from './pages/Administracao';
import { Configuracoes } from './pages/Configuracoes';
import { MeuPerfil } from './pages/MeuPerfil';

const AppContent: React.FC = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'almoxarifado':
        return <Almoxarifado />;
      case 'compras':
        return <Compras />;
      case 'patrimonio':
        return <Patrimonio />;
      case 'inventario':
        return <Inventario />;
      case 'centro-custos':
        return <CentroDeCustos onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'unidades':
        return <Unidades />;
      case 'relatorios':
        return <Relatorios />;
      case 'indicadores':
        return <Indicadores />;
      case 'assistente-ia':
        return <AssistenteIA />;
      case 'administracao':
        if (currentUser?.role !== 'Master' && currentUser?.role !== 'Gestor') {
          return <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />;
        }
        return <Administracao />;
      case 'configuracoes':
        return <Configuracoes />;
      case 'meu-perfil':
        return <MeuPerfil />;
      default:
        return <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <Box className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      <Navbar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        onNavigateToTab={(tab) => setCurrentTab(tab)}
      />

      <Box className="flex flex-1 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          open={sidebarOpen}
        />

        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderActiveTab()}
        </main>
      </Box>

      {/* Mandatory first access password change modal */}
      <FirstAccessModal />
    </Box>
  );
};

export function App() {
  return (
    <ThemeContextProvider>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </ThemeContextProvider>
  );
}

export default App;
