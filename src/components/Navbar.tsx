import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, IconButton, Box, Badge, Menu, MenuItem,
  Select, FormControl, Chip, Avatar, Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import {
  Bell, Sun, Moon, LogOut, Building2, Shield,
  Menu as MenuIcon, Layers, RefreshCw, Bot, HelpCircle, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useThemeContext } from '../context/ThemeContext';
import { Branch, UserRole } from '../types';
import { NotificationDrawer } from './NotificationDrawer';
import { GlobalSearchBar } from './GlobalSearchBar';
import { dataService } from '../services/dataService';
import { AppIcon } from './AppIcon';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigateToTab }) => {
  const { currentUser, logout, switchRole } = useAuth();
  const { selectedBranch, setSelectedBranch, refreshData } = useApp();
  const { mode, toggleTheme } = useThemeContext();

  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [roleMenuAnchor, setRoleMenuAnchor] = useState<null | HTMLElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const activeBranches = dataService.getBranches(true);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  const notifications = dataService.getState().notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleBranchChange = (event: any) => {
    setSelectedBranch(event.target.value as Branch | 'GLOBAL');
    refreshData();
  };

  const handleQuickRoleChange = (role: UserRole, branch?: Branch) => {
    switchRole(role, branch);
    setRoleMenuAnchor(null);
    setUserMenuAnchor(null);
    refreshData();
  };

  const buttonStyleClass = "w-11 h-11 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-all duration-200 flex items-center justify-center shrink-0";

  return (
    <>
      <AppBar 
        position="sticky" 
        elevation={0}
        color="default"
        sx={{
          backgroundColor: mode === 'dark' ? '#0f172a' : '#F8FAFC',
          backgroundImage: 'none',
          color: 'inherit',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
        }}
        className="backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 z-30 h-[72px]"
      >
        <Toolbar className="justify-between px-4 md:px-6 h-[72px] min-h-[72px] gap-5">
          {/* Left: Menu toggle, Brand Logo */}
          <Box className="flex items-center gap-5 shrink-0">
            <Tooltip title="Alternar Menu Lateral">
              <IconButton 
                edge="start" 
                onClick={onToggleSidebar} 
                className={buttonStyleClass}
              >
                <AppIcon icon={MenuIcon} size={20} className="text-slate-600 dark:text-slate-300 hover:text-blue-600" />
              </IconButton>
            </Tooltip>

            <Box className="flex items-center gap-3">
              <Box className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black shadow-xs">
                <AppIcon icon={Layers} size={22} className="text-white" />
              </Box>
              <div className="hidden sm:block">
                <Typography variant="h6" className="font-extrabold tracking-tight text-slate-900 dark:text-white leading-none text-base md:text-lg">
                  Almox<span className="text-blue-600 dark:text-blue-400">Plus</span>
                </Typography>
                <Typography variant="caption" className="text-slate-500 dark:text-slate-400 font-medium text-[10px] block mt-0.5">
                  ERP Empresarial
                </Typography>
              </div>
            </Box>
          </Box>

          {/* Center: Branch Selector & Global Search Bar */}
          <Box className="hidden md:flex items-center gap-4 flex-1 max-w-[680px] mx-auto justify-center">
            <Box className="flex items-center shrink-0">
              {(currentUser?.role === 'Master' || currentUser?.role === 'Gestor') ? (
                <FormControl size="small" variant="outlined" className="min-w-[150px]">
                  <Select
                    value={selectedBranch}
                    onChange={handleBranchChange}
                    className="bg-white dark:bg-slate-800 text-xs font-semibold rounded-xl h-10 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-slate-400 transition-colors"
                  >
                    <MenuItem value="GLOBAL" className="text-xs font-semibold">
                      🌐 Todas as Unidades
                    </MenuItem>
                    {activeBranches.map(b => (
                      <MenuItem key={b.id} value={b.code} className="text-xs">
                        🏢 Unidade {b.code} ({b.city})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Chip
                  icon={<AppIcon icon={Building2} size={14} className="text-blue-600 dark:text-blue-400" />}
                  label={`Unidade ${currentUser?.branch}`}
                  color="primary"
                  variant="outlined"
                  size="small"
                  className="font-bold text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 h-10 px-1 shadow-xs"
                />
              )}
            </Box>

            {/* Global Search Bar */}
            <Box className="flex-1 max-w-[480px]">
              <GlobalSearchBar />
            </Box>
          </Box>

          {/* Right: Actions & User Profile */}
          <Box className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Quick Refresh */}
            <Tooltip title="Atualizar dados do sistema">
              <IconButton onClick={refreshData} className={buttonStyleClass}>
                <AppIcon icon={RefreshCw} size={18} className="text-slate-600 dark:text-slate-300" />
              </IconButton>
            </Tooltip>

            {/* AI Assistant Quick Link */}
            <Tooltip title="Assistente IA AlmoxBot">
              <IconButton 
                onClick={() => onNavigateToTab?.('assistente-ia')} 
                className={`${buttonStyleClass} bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/60`}
              >
                <AppIcon icon={Bot} size={18} className="text-purple-600 dark:text-purple-400" />
              </IconButton>
            </Tooltip>

            {/* Theme Toggle */}
            <Tooltip title={mode === 'light' ? 'Modo Escuro' : 'Modo Claro'}>
              <IconButton onClick={toggleTheme} className={buttonStyleClass}>
                {mode === 'light' ? (
                  <AppIcon icon={Moon} size={18} className="text-slate-600" />
                ) : (
                  <AppIcon icon={Sun} size={18} className="text-amber-400" />
                )}
              </IconButton>
            </Tooltip>

            {/* Notifications */}
            <Tooltip title="Central de Notificações">
              <IconButton onClick={() => setNotifOpen(true)} className={buttonStyleClass}>
                <Badge badgeContent={unreadCount} color="error" max={99} className="shadow-xs">
                  <AppIcon icon={Bell} size={18} className="text-slate-600 dark:text-slate-300" />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Help / Docs */}
            <Tooltip title="Ajuda e Suporte">
              <IconButton onClick={() => setHelpDialogOpen(true)} className={buttonStyleClass}>
                <AppIcon icon={HelpCircle} size={18} className="text-slate-600 dark:text-slate-300" />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem className="mx-1 h-6 self-center border-slate-200 dark:border-slate-800" />

            {/* User Profile Button */}
            {currentUser && (
              <Box 
                className="flex items-center gap-2.5 cursor-pointer p-1.5 px-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors duration-200 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-xs"
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              >
                <Avatar 
                  src={currentUser.avatarUrl} 
                  className="w-9 h-9 text-xs font-bold bg-white text-blue-600 border border-slate-200 dark:bg-slate-800 dark:text-blue-400 dark:border-slate-700 shadow-xs"
                >
                  {currentUser.name.charAt(0)}
                </Avatar>
                <div className="hidden lg:block text-left pr-1">
                  <Typography variant="body2" className="font-bold text-xs text-slate-700 dark:text-slate-200 leading-tight">
                    {currentUser.name}
                  </Typography>
                  <Typography variant="caption" className="text-slate-500 dark:text-slate-400 text-[10px] block leading-tight mt-0.5">
                    Perfil: <span className={`font-bold ${currentUser.role === 'Master' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>{currentUser.role}</span>
                  </Typography>
                </div>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Help Dialog */}
      <Dialog 
        open={helpDialogOpen} 
        onClose={() => setHelpDialogOpen(false)}
        slotProps={{ paper: { className: "rounded-2xl p-2 max-w-md dark:bg-slate-900 dark:text-white" } }}
      >
        <DialogTitle className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <AppIcon icon={HelpCircle} size={22} className="text-blue-600 dark:text-blue-400" />
          Central de Ajuda - Almox Plus
        </DialogTitle>
        <DialogContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Bem-vindo ao <strong>Almox Plus ERP</strong>. Aqui você encontra atalhos rápidos para navegação e suporte do sistema:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong>Ctrl + K:</strong> Abre a busca global no sistema para encontrar qualquer produto, OC ou patrimônio.</li>
            <li><strong>Assistente IA:</strong> Obtenha diagnósticos automáticos e relatórios preditivos no topo.</li>
            <li><strong>Filtros por Unidade:</strong> Alterne de forma transparente entre unidades RJ, SP, SJRP e BSB.</li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)} variant="contained" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
            Entendi
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Menu Dropdown */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        slotProps={{
          paper: {
            elevation: 4,
            className: "mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-1.5 shadow-xl"
          }
        }}
      >
        <Box className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-1">
          <Typography variant="subtitle2" className="font-bold text-slate-900 dark:text-slate-100 text-xs">
            {currentUser?.name}
          </Typography>
          <Typography variant="caption" className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
            {currentUser?.email}
          </Typography>
          <Box className="flex items-center gap-1.5 mt-2">
            <Chip 
              label={currentUser?.role} 
              size="small" 
              color={currentUser?.role === 'Master' ? 'primary' : currentUser?.role === 'Regular' ? 'info' : 'default'}
              className="font-bold text-[10px] h-5"
            />
            <Chip 
              label={`Unidade: ${currentUser?.branch}`} 
              size="small" 
              variant="outlined" 
              className="text-[10px] h-5 border-slate-300 dark:border-slate-700"
            />
          </Box>
        </Box>

        <Divider className="my-1" />

        <MenuItem onClick={() => { setUserMenuAnchor(null); onNavigateToTab?.('configuracoes'); }} className="text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <AppIcon icon={Settings} size={16} className="mr-2.5 text-blue-500" />
          Configurações do Perfil
        </MenuItem>

        <Divider className="my-1" />

        <MenuItem onClick={() => { setUserMenuAnchor(null); logout(); }} className="text-xs font-semibold text-rose-600 dark:text-rose-400 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50">
          <AppIcon icon={LogOut} size={16} className="mr-2.5 text-rose-600 dark:text-rose-400" />
          Sair do Sistema
        </MenuItem>
      </Menu>

      {/* Notification Drawer */}
      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onRefresh={refreshData}
      />
    </>
  );
};
