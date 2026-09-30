import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Typography, Box, Alert, IconButton, InputAdornment
} from '@mui/material';
import { Lock, KeyRound, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const FirstAccessModal: React.FC = () => {
  const { isFirstAccess, changePassword, currentUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isFirstAccess || !currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não confere com a nova senha.');
      return;
    }

    changePassword(newPassword);
  };

  return (
    <Dialog open={true} onClose={(_, reason) => { if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; }} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle className="bg-slate-900 text-white flex items-center gap-2 py-4">
          <KeyRound className="w-5 h-5 text-amber-400" />
          <Typography variant="h6" className="font-bold">
            Primeiro Acesso - Troca Obrigatória
          </Typography>
        </DialogTitle>
        <DialogContent dividers className="py-6 space-y-4">
          <Alert severity="info" icon={<ShieldAlert className="w-5 h-5" />}>
            Olá, <strong>{currentUser.name}</strong>! Por motivos de segurança, você deve definir sua nova senha pessoal no primeiro acesso.
          </Alert>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            type={showPass ? 'text' : 'password'}
            label="Nova Senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
            helperText="Mínimo de 6 caracteres"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPass(!showPass)} edge="end">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </IconButton>
                  </InputAdornment>
                )
              }
            }}
          />

          <TextField
            fullWidth
            type={showPass ? 'text' : 'password'}
            label="Confirmar Nova Senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            helperText="Repita a mesma senha digitada"
          />
        </DialogContent>
        <DialogActions className="px-6 py-4 bg-slate-50 dark:bg-slate-900">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5"
          >
            Atualizar Senha e Acessar Sistema
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
