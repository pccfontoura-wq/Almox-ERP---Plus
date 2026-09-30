import React, { useState } from 'react';
import {
  Box, Typography, Card, TextField, Button, Alert, Avatar, Chip, IconButton, InputAdornment
} from '@mui/material';
import { Save, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';

export const MeuPerfil: React.FC = () => {
  const { currentUser, changePassword } = useAuth();

  const [name, setName] = useState(currentUser?.name || '');
  const [email] = useState(currentUser?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve possuir pelo menos 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas digitadas não conferem.' });
      return;
    }

    try {
      changePassword(newPassword, currentPassword);
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Meu Perfil de Usuário' }]} />

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-6">
        <Box className="flex items-center gap-4 mb-6">
          <Avatar className="w-16 h-16 bg-blue-600 text-xl font-bold">
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100">
              {currentUser?.name}
            </Typography>
            <Typography variant="body2" className="text-slate-500 text-xs">
              {currentUser?.email}
            </Typography>
            <Box className="flex items-center gap-2 mt-2">
              <Chip label={`Perfil: ${currentUser?.role}`} color="primary" size="small" className="font-bold text-[10px] h-5" />
              <Chip label={`Unidade: ${currentUser?.branch}`} variant="outlined" size="small" className="font-bold text-[10px] h-5" />
            </Box>
          </div>
        </Box>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <TextField
              fullWidth
              label="Nome Completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <TextField
              fullWidth
              label="E-mail Corporativo"
              value={email}
              disabled
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            Alterar Senha de Acesso
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => setShowPass(!showPass)}
            startIcon={showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            className="text-xs normal-case"
          >
            {showPass ? 'Ocultar senhas' : 'Ver senhas digitadas'}
          </Button>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <TextField
            fullWidth
            type={showPass ? 'text' : 'password'}
            label="Senha Atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            helperText="Digite sua senha atual de acesso"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              fullWidth
              type={showPass ? 'text' : 'password'}
              label="Nova Senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              helperText="Mínimo de 6 caracteres"
            />

            <TextField
              fullWidth
              type={showPass ? 'text' : 'password'}
              label="Confirme a Nova Senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              helperText="Repita a mesma nova senha"
            />
          </div>

          <Box className="flex justify-end">
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<Save className="w-4 h-4" />}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Atualizar Senha
            </Button>
          </Box>
        </form>
      </Card>
    </Box>
  );
};
