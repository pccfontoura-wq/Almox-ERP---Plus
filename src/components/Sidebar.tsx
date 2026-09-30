import React from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Chip, Tooltip, Avatar } from '@mui/material';
import {
  LayoutDashboard, Package, ShoppingCart, Landmark, ClipboardCheck,
  Calculator, BarChart3, TrendingUp, Bot, ShieldCheck, Settings, User, Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { AppIcon } from './AppIcon';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  open: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, open }) => {
  const { currentUser } = useAuth();

  const state = dataService.getState();
  const pendingInternalReqsCount = state.requisitions.filter(r => r.status === 'PENDENTE').length;
  const pendingPurchaseCount = ((state.purchaseRequests || []).filter(r => r.status === 'PENDENTE' || r.status === 'PARCIALMENTE_ATENDIDA').length) + 
    ((state.purchaseOrders || []).filter(po => po.status === 'AGUARDANDO_APROVACAO').length);
  const inTransitTransfersCount = state.transfers.filter(t => t.status === 'EM_TRANSITO').length;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'almoxarifado', label: 'Almoxarifado', icon: Package, badge: pendingInternalReqsCount > 0 ? `${pendingInternalReqsCount} reqs` : (inTransitTransfersCount > 0 ? `${inTransitTransfersCount} trânsito` : null) },
    { id: 'compras', label: 'Compras', icon: ShoppingCart, badge: pendingPurchaseCount > 0 ? `${pendingPurchaseCount} pendentes` : null },
    { id: 'patrimonio', label: 'Patrimônio', icon: Landmark },
    { id: 'inventario', label: 'Inventário', icon: ClipboardCheck },
    { id: 'centro-custos', label: 'Centro de Custos', icon: Calculator },
    { id: 'unidades', label: 'Unidades', icon: Building2, badge: `${(state.branches || []).filter(b => b.active).length} ativas` },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'indicadores', label: 'Indicadores KPIs', icon: TrendingUp },
    { id: 'assistente-ia', label: 'Assistente IA', icon: Bot, isNew: true },
    { id: 'administracao', label: 'Administração', icon: ShieldCheck, masterOnly: true },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
    { id: 'meu-perfil', label: 'Meu Perfil', icon: User }
  ];

  return (
    <Box 
      className={`bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition-all duration-300 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 ${open ? 'w-64' : 'w-20'} overflow-y-auto select-none`}
    >
      <List className="px-2.5 py-4 space-y-1.5 flex-1">
        {menuItems.map((item) => {
          if (item.masterOnly && currentUser?.role !== 'Master') {
            return null; // Restricted menu item
          }

          const Icon = item.icon;
          const isSelected = currentTab === item.id;

          const buttonContent = (
            <ListItemButton
              selected={isSelected}
              onClick={() => onSelectTab(item.id)}
              className={`rounded-xl transition-all duration-200 py-2.5 px-3 group flex items-center ${
                isSelected 
                  ? 'bg-blue-100/90 dark:bg-blue-950/70 border-l-4 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 font-semibold shadow-xs pl-2.5' 
                  : 'hover:bg-slate-200/70 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <ListItemIcon className="min-w-[36px] flex items-center justify-center">
                <AppIcon 
                  icon={Icon} 
                  size={20} 
                  className={`transition-colors duration-200 ${
                    isSelected 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                  }`} 
                />
              </ListItemIcon>

              {open && (
                <ListItemText 
                  disableTypography
                  primary={
                    <Box className="flex items-center justify-between gap-1">
                      <Typography component="div" className={`text-xs tracking-tight ${isSelected ? 'font-bold text-blue-700 dark:text-blue-300' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                        {item.label}
                      </Typography>
                      {item.badge && (
                        <Chip label={item.badge} size="small" className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold h-4 px-1" />
                      )}
                      {item.isNew && (
                        <Chip label="IA" size="small" className="bg-purple-600 text-white text-[9px] font-bold h-4 px-1 shadow-xs" />
                      )}
                    </Box>
                  } 
                />
              )}
            </ListItemButton>
          );

          return (
            <ListItem key={item.id} disablePadding className="block">
              {!open ? (
                <Tooltip title={item.label} placement="right" arrow>
                  {buttonContent}
                </Tooltip>
              ) : (
                buttonContent
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Footer Info & User Card inside Sidebar */}
      {open ? (
        <Box className="mt-auto p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40">
          <Box className="flex items-center gap-2.5 mb-2">
            <Avatar className="w-8 h-8 text-xs font-bold bg-blue-600 text-white shadow-xs">
              {currentUser?.name.charAt(0) || 'U'}
            </Avatar>
            <div className="overflow-hidden">
              <Typography variant="body2" className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                {currentUser?.name}
              </Typography>
              <Typography variant="caption" className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">
                Unidade: <span className="font-semibold text-blue-600 dark:text-blue-400">{currentUser?.branch || 'SP'}</span> ({currentUser?.role})
              </Typography>
            </div>
          </Box>
          <Box className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>AlmoxPlus v2.5</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">• Online</span>
          </Box>
        </Box>
      ) : (
        <Box className="mt-auto py-3 text-center border-t border-slate-200 dark:border-slate-800">
          <Avatar className="w-8 h-8 mx-auto text-xs font-bold bg-blue-600 text-white shadow-xs">
            {currentUser?.name.charAt(0) || 'U'}
          </Avatar>
        </Box>
      )}
    </Box>
  );
};
