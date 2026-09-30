import React from 'react';
import {
  Drawer, Box, Typography, IconButton, List, ListItem, ListItemText,
  Badge, Button, Chip, Divider
} from '@mui/material';
import { X, Bell, AlertTriangle, Info, CheckCircle2, AlertOctagon, Trash2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { SystemNotification } from '../types';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
  onRefresh: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  open,
  onClose,
  notifications,
  onRefresh
}) => {
  const handleMarkRead = (id: string) => {
    dataService.markNotificationRead(id);
    onRefresh();
  };

  const handleClearAll = () => {
    dataService.clearAllNotifications();
    onRefresh();
  };

  const getIcon = (type: SystemNotification['type']) => {
    switch (type) {
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'ERROR':
        return <AlertOctagon className="w-5 h-5 text-rose-500" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'INFO':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box className="w-80 md:w-96 p-4 h-full flex flex-col bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <Box className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <Box className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100">
              Notificações
            </Typography>
            {notifications.filter(n => !n.read).length > 0 && (
              <Chip 
                label={`${notifications.filter(n => !n.read).length} novas`} 
                color="error" 
                size="small" 
                className="font-bold text-xs"
              />
            )}
          </Box>
          <IconButton size="small" onClick={onClose}>
            <X className="w-5 h-5 text-slate-500" />
          </IconButton>
        </Box>

        {/* Notifications List */}
        <Box className="flex-1 overflow-y-auto py-2">
          {notifications.length === 0 ? (
            <Box className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <Typography variant="body2">Nenhuma notificação no momento.</Typography>
            </Box>
          ) : (
            <List className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => (
                <ListItem
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`p-3 rounded-lg transition-colors cursor-pointer mb-1 ${
                    n.read 
                      ? 'bg-white dark:bg-slate-800/40 opacity-70' 
                      : 'bg-white dark:bg-slate-800 border-l-4 border-blue-600 shadow-xs'
                  }`}
                >
                  <Box className="mr-3 mt-1">{getIcon(n.type)}</Box>
                  <ListItemText
                    disableTypography
                    primary={
                      <Box className="flex items-center justify-between gap-1">
                        <Typography variant="subtitle2" component="div" className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {n.title}
                        </Typography>
                        <Typography variant="caption" component="span" className="text-slate-400 text-[10px]">
                          {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box className="mt-1">
                        <Typography variant="body2" component="div" className="text-slate-600 dark:text-slate-300 text-xs">
                          {n.message}
                        </Typography>
                        <Box className="flex items-center justify-between mt-2">
                          <Chip label={`Unidade: ${n.branch}`} size="small" className="text-[10px] h-4 bg-slate-100 dark:bg-slate-700" />
                          {!n.read && (
                            <Typography variant="caption" component="span" className="text-blue-600 font-semibold text-[10px]">
                              Marcar lida
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Footer Actions */}
        {notifications.length > 0 && (
          <Box className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              size="small"
              onClick={handleClearAll}
              startIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
              className="text-slate-600 dark:text-slate-300"
            >
              Limpar Notificações
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};
