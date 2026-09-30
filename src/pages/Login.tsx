import React, { useState } from 'react';
import {
  Card, CardContent, Typography, TextField, Button, Box, Alert,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, InputAdornment, Avatar
} from '@mui/material';
import { Layers, Lock, Mail, ArrowRight, KeyRound, Eye, EyeOff, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { User } from '../types';

export const Login: React.FC = () => {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Recovery modal states
  const [recoverModalOpen, setRecoverModalOpen] = useState(false);
  const [recoverStep, setRecoverStep] = useState<1 | 2>(1);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  const [newRecoverPassword, setNewRecoverPassword] = useState('');
  const [confirmRecoverPassword, setConfirmRecoverPassword] = useState('');
  const [showRecoverPass, setShowRecoverPass] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessBanner(null);

    const res = login(email, password);
    if (!res.success) {
      setError(res.error || 'Login ou senha incorretos.');
    }
  };

  const handleOpenRecovery = () => {
    setRecoverModalOpen(true);
    setRecoverStep(1);
    setRecoverEmail(email || '');
    setMatchedUser(null);
    setRecoverError(null);
    setNewRecoverPassword('');
    setConfirmRecoverPassword('');
  };

  const handleFindUserToRecover = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError(null);

    const cleanEmail = recoverEmail.trim().toLowerCase();
    const user = dataService.findUserByEmail(cleanEmail);

    if (!user) {
      setRecoverError(`Nenhum usuário localizado com o e-mail "${recoverEmail}". Verifique o endereço ou consulte o administrador Master.`);
      return;
    }

    setMatchedUser(user);
    setRecoverStep(2);
  };

  const handleExecutePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError(null);

    if (!newRecoverPassword || newRecoverPassword.trim().length < 6) {
      setRecoverError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }

    if (newRecoverPassword !== confirmRecoverPassword) {
      setRecoverError('A confirmação de senha não confere com a nova senha digitada.');
      return;
    }

    const res = resetPassword(recoverEmail, newRecoverPassword.trim());

    if (!res.success) {
      setRecoverError(res.error || 'Erro ao redefinir a senha.');
      return;
    }

    // Auto-fill login screen
    setEmail(recoverEmail.trim());
    setPassword(newRecoverPassword.trim());
    setRecoverModalOpen(false);
    setSuccessBanner(`Senha redefinida com sucesso para o usuário ${matchedUser?.name}! Clique em "Entrar no Sistema" abaixo.`);
    setError(null);
  };

  return (
    <Box className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden z-10">
        {/* Brand Header */}
        <Box className="bg-slate-950 p-8 text-center border-b border-slate-800">
          <Box className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-slate-900 via-blue-900 to-blue-600 flex items-center justify-center text-white font-black shadow-lg">
            <Layers className="w-8 h-8 text-blue-400" />
          </Box>
          <Typography variant="h5" className="font-extrabold text-white tracking-tight">
            Almox<span className="text-blue-500">Plus</span> ERP
          </Typography>
          <Typography variant="caption" className="text-slate-400 font-medium block mt-1">
            Gestão Empresarial de Almoxarifado, Compras & Patrimônio
          </Typography>
        </Box>

        <CardContent className="p-8">
          {successBanner && (
            <Alert severity="success" className="mb-6 rounded-xl font-medium shadow-sm" onClose={() => setSuccessBanner(null)}>
              {successBanner}
            </Alert>
          )}

          {error && (
            <Alert severity="error" className="mb-6 rounded-xl font-medium" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              label="E-mail Corporativo"
              type="email"
              placeholder="seu.email@almoxplus.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </InputAdornment>
                  )
                }
              }}
            />

            <TextField
              fullWidth
              label="Senha de Acesso"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            <Box className="flex justify-end">
              <Button
                size="small"
                onClick={handleOpenRecovery}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline capitalize"
              >
                Esqueceu a senha?
              </Button>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              endIcon={<ArrowRight className="w-4 h-4" />}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md"
            >
              Entrar no Sistema
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Interactive Password Recovery Dialog */}
      <Dialog open={recoverModalOpen} onClose={() => setRecoverModalOpen(false)} maxWidth="xs" fullWidth>
        {recoverStep === 1 ? (
          <form onSubmit={handleFindUserToRecover}>
            <DialogTitle className="font-bold flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
              <KeyRound className="w-5 h-5 text-amber-500" />
              Recuperação de Senha
            </DialogTitle>
            <DialogContent dividers className="space-y-4">
              {recoverError && (
                <Alert severity="error" onClose={() => setRecoverError(null)}>
                  {recoverError}
                </Alert>
              )}

              <Typography variant="body2" className="text-slate-600 dark:text-slate-300 text-xs">
                Informe o seu e-mail cadastrado no Almox Plus para localizar sua conta e definir uma nova senha de acesso imediatamente.
              </Typography>

              <TextField
                fullWidth
                type="email"
                label="E-mail Corporativo Cadastrado"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                required
                placeholder="seu.email@empresa.com.br"
                autoFocus
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail className="w-4 h-4 text-slate-400" />
                      </InputAdornment>
                    )
                  }
                }}
              />
            </DialogContent>
            <DialogActions className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={() => setRecoverModalOpen(false)} color="inherit">
                Cancelar
              </Button>
              <Button type="submit" variant="contained" color="primary" className="font-bold">
                Localizar Conta
              </Button>
            </DialogActions>
          </form>
        ) : (
          <form onSubmit={handleExecutePasswordReset}>
            <DialogTitle className="font-bold flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              Definir Nova Senha
            </DialogTitle>
            <DialogContent dividers className="space-y-4">
              {recoverError && (
                <Alert severity="error" onClose={() => setRecoverError(null)}>
                  {recoverError}
                </Alert>
              )}

              {/* Matched User Card */}
              {matchedUser && (
                <Box className="p-3 bg-blue-50 dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-slate-700 flex items-center gap-3">
                  <Avatar className="w-10 h-10 bg-blue-600 font-bold text-white text-sm">
                    {matchedUser.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Typography variant="subtitle2" className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {matchedUser.name}
                    </Typography>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Chip label={`Perfil: ${matchedUser.role}`} size="small" color="primary" className="text-[9px] h-4 font-bold" />
                      <Chip label={`Unidade: ${matchedUser.branch}`} size="small" variant="outlined" className="text-[9px] h-4 font-bold" />
                    </div>
                  </div>
                </Box>
              )}

              <Typography variant="body2" className="text-slate-600 dark:text-slate-300 text-xs">
                Crie uma nova senha de acesso para sua conta:
              </Typography>

              <TextField
                fullWidth
                label="Nova Senha"
                type={showRecoverPass ? 'text' : 'password'}
                value={newRecoverPassword}
                onChange={(e) => setNewRecoverPassword(e.target.value)}
                required
                autoFocus
                helperText="Mínimo 6 caracteres"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowRecoverPass(!showRecoverPass)} edge="end">
                          {showRecoverPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />

              <TextField
                fullWidth
                label="Confirmar Nova Senha"
                type={showRecoverPass ? 'text' : 'password'}
                value={confirmRecoverPassword}
                onChange={(e) => setConfirmRecoverPassword(e.target.value)}
                required
                helperText="Repita a mesma senha"
              />
            </DialogContent>
            <DialogActions className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={() => setRecoverStep(1)} color="inherit">
                Voltar
              </Button>
              <Button type="submit" variant="contained" color="success" className="font-bold">
                Salvar Nova Senha
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </Box>
  );
};
