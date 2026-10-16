import React, { useState } from 'react';
import {
  Card, CardContent, Typography, TextField, Button, Box, Alert,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, InputAdornment, Avatar, Tooltip
} from '@mui/material';
import {
  Layers, Lock, Mail, ArrowRight, KeyRound, Eye, EyeOff, UserCheck,
  ShieldAlert, PhoneCall, Copy, Check, Send, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { User } from '../types';
import { copyToClipboard } from '../utils/clipboard';

export const Login: React.FC = () => {
  const { login, resetPassword, failedAttempts, unlockUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const cleanCurrentEmail = email.toLowerCase().trim();
  const attemptInfo = failedAttempts[cleanCurrentEmail];
  const isCurrentBlocked = Boolean(attemptInfo?.blocked);

  // Contact administrator modal states
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'email' | 'message' | null>(null);
  const [unlockRequested, setUnlockRequested] = useState(false);

  // Administrator resolution: specifically regular/operational administrator, NOT master zynecta@gmail.com
  const allUsers = dataService.getState?.()?.users || [];
  const adminUser = allUsers.find(u => u.email.toLowerCase() !== 'zynecta@gmail.com' && (u.role === 'Master' || u.role === 'Gestor' || u.name.toLowerCase().includes('admin'))) || allUsers.find(u => u.email.toLowerCase() === 'admin@almoxplus.com.br');
  const adminEmail = adminUser?.email || 'admin@almoxplus.com.br';
  const adminName = adminUser?.name || 'Administrador do Sistema';

  // Suporte de TI Corporativo: caso não exista, deixar em branco
  const corporateItSupport = '';

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

  const formattedMessage = `Assunto: Solicitação de Desbloqueio de Acesso - AlmoxPlus ERP

Olá Administrador,

Solicito o desbloqueio do meu acesso corporativo no sistema AlmoxPlus ERP.
• E-mail do Usuário: ${cleanCurrentEmail || 'meu.email@almoxplus.com.br'}
• Data e Horário: ${new Date().toLocaleString('pt-BR')}
• Motivo: Limite de 3 tentativas incorretas excedido

Por favor, providencie o desbloqueio para que eu possa retomar minhas atividades corporativas.

Atenciosamente.`;

  const handleCopyEmail = async () => {
    try {
      await copyToClipboard(adminEmail);
      setCopiedType('email');
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      setCopiedType('email');
    }
  };

  const handleCopyMessage = async () => {
    try {
      await copyToClipboard(formattedMessage);
      setCopiedType('message');
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      setCopiedType('message');
    }
  };

  const handleSendUnlockRequest = () => {
    const userEmail = cleanCurrentEmail || 'usuario.solicitante@almoxplus.com.br';
    dataService.logAudit(
      { id: 'ANONYMOUS', name: userEmail, role: 'Visitante', branch: 'SP', email: userEmail, active: true, firstAccess: false, createdAt: '' },
      'CONFIGURACAO',
      'Segurança',
      `Solicitação formal de desbloqueio enviada pelo usuário ${userEmail} para o Administrador (${adminEmail}).`,
      null,
      null,
      'SP'
    );
    try {
      const pending = JSON.parse(localStorage.getItem('almoxplus_unlock_requests') || '[]');
      if (!pending.includes(userEmail)) {
        pending.push(userEmail);
        localStorage.setItem('almoxplus_unlock_requests', JSON.stringify(pending));
      }
    } catch (e) {
      console.error(e);
    }
    setUnlockRequested(true);
  };

  const handleSafeOpenEmail = () => {
    try {
      const subject = encodeURIComponent('Solicitação de Desbloqueio de Acesso - AlmoxPlus ERP');
      const body = encodeURIComponent(formattedMessage);
      const mailtoUrl = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
      // In web app / iframe, standard anchor prevents window.open popup rejections
      const a = document.createElement('a');
      a.href = mailtoUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      handleCopyEmail();
    }
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
            <Alert
              severity={isCurrentBlocked || error.includes('bloqueado') ? 'error' : 'warning'}
              className="mb-6 rounded-xl font-medium shadow-sm"
              onClose={() => setError(null)}
            >
              <div className="font-semibold">{error}</div>
            </Alert>
          )}

          {/* Blocked Account & Contact Administrator Card */}
          {(isCurrentBlocked || (error && error.includes('bloqueado'))) && (
            <Box className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 shadow-sm">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-extrabold text-sm mb-1.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Acesso Bloqueado por Segurança (3 Tentativas)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                Você atingiu o limite máximo de <strong>3 tentativas incorretas</strong>. Por diretriz de segurança corporativa, este acesso foi bloqueado.
                <br />
                <strong>Por favor, entre em contato com o administrador do sistema para solicitar o desbloqueio.</strong>
              </p>

              <div className="bg-white dark:bg-slate-900/90 p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs space-y-1.5 font-sans mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Administrador:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      {adminEmail}
                    </span>
                    <Tooltip title="Copiar e-mail do administrador">
                      <IconButton
                        size="small"
                        onClick={handleCopyEmail}
                        className="p-1 text-slate-400 hover:text-blue-600"
                      >
                        {copiedType === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Suporte TI Corporativo:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {corporateItSupport || ''}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-rose-200 dark:border-rose-900/50">
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => {
                    setContactModalOpen(true);
                    setUnlockRequested(false);
                  }}
                  startIcon={<Mail className="w-3.5 h-3.5 text-white" />}
                  className="text-xs font-bold capitalize py-1.5 px-3.5 shadow-none text-white bg-rose-600 hover:bg-rose-700"
                >
                  Contatar Administrador
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    unlockUser(cleanCurrentEmail);
                    setError(null);
                    setSuccessBanner(`Acesso para ${cleanCurrentEmail} foi desbloqueado (modo simulação). Você pode tentar novamente.`);
                  }}
                  className="text-[11px] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 normal-case"
                  title="Permite reiniciar tentativas para fins de teste no protótipo"
                >
                  Desbloquear para Testes
                </Button>
              </div>
            </Box>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              fullWidth
              label="E-mail Corporativo"
              type="email"
              placeholder="seu.email@almoxplus.com.br"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
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

            {/* Warning indicator if there are prior failed attempts but not yet locked */}
            {attemptInfo && !isCurrentBlocked && attemptInfo.count > 0 && (
              <Box className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-between">
                <span>⚠️ <strong>Atenção:</strong> {attemptInfo.count} de 3 tentativas já utilizadas.</span>
                <span className="font-semibold">Resta{3 - attemptInfo.count === 1 ? '' : 'm'} {3 - attemptInfo.count}</span>
              </Box>
            )}

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
              disabled={isCurrentBlocked}
              endIcon={<ArrowRight className="w-4 h-4" />}
              className={`text-white font-bold py-3 rounded-xl shadow-md ${
                isCurrentBlocked
                  ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700'
              }`}
            >
              {isCurrentBlocked ? 'Acesso Bloqueado (Contate o Administrador)' : 'Entrar no Sistema'}
            </Button>

            {/* Master Credentials Box */}
            <Box className="mt-5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <Box className="flex items-center justify-between mb-2">
                <Box className="flex items-center gap-1.5">
                  <span className="text-sm">👑</span>
                  <Typography variant="caption" className="font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 text-[11px]">
                    Acesso Master do Sistema
                  </Typography>
                </Box>
                <Chip
                  label="Acesso Total"
                  size="small"
                  color="primary"
                  className="text-[10px] h-5 font-bold"
                />
              </Box>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 mb-2.5 bg-white dark:bg-slate-900/70 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans text-[11px]">E-mail Master:</span>
                  <strong className="text-blue-600 dark:text-blue-400 select-all font-semibold">zynecta@gmail.com</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-sans text-[11px]">Senha Master:</span>
                  <strong className="text-slate-800 dark:text-slate-200 select-all font-semibold">Zynecta@1973</strong>
                </div>
              </div>

              <Button
                fullWidth
                size="small"
                variant="outlined"
                onClick={() => {
                  setEmail('zynecta@gmail.com');
                  setPassword('Zynecta@1973');
                  setError(null);
                }}
                className="text-xs font-bold py-1.5 rounded-lg border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                Preencher Acesso Master (1-Clique)
              </Button>
            </Box>
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

      {/* Dialog for Contacting Administrator to Unlock Account */}
      <Dialog
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            className: "rounded-2xl p-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          }
        }}
      >
        <DialogTitle className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <Typography variant="h6" className="text-base font-bold leading-tight">
              Solicitar Desbloqueio de Acesso
            </Typography>
            <Typography variant="caption" className="text-slate-500 dark:text-slate-400 block">
              Limite de 3 tentativas excedido para {cleanCurrentEmail || 'seu usuário'}
            </Typography>
          </div>
        </DialogTitle>

        <DialogContent className="py-4 space-y-4">
          {unlockRequested ? (
            <Alert severity="success" icon={<Check className="w-5 h-5" />} className="rounded-xl">
              <Typography variant="subtitle2" className="font-bold">
                Solicitação Registrada no Sistema!
              </Typography>
              <Typography variant="caption" className="block mt-0.5">
                O Administrador ({adminEmail}) recebeu sua solicitação e poderá liberar seu acesso através do módulo de Administração do AlmoxPlus.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="warning" className="rounded-xl text-xs">
              Por diretriz corporativa de segurança e auditoria, o sistema bloqueia acessos após 3 tentativas inválidas. Você pode solicitar o desbloqueio diretamente pelos canais abaixo.
            </Alert>
          )}

          {/* Contact Information Cards */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  E-mail do Administrador
                </span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {adminEmail}
                </span>
              </div>
              <Button
                size="small"
                variant={copiedType === 'email' ? 'contained' : 'outlined'}
                color={copiedType === 'email' ? 'success' : 'primary'}
                startIcon={copiedType === 'email' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={handleCopyEmail}
                className="text-xs font-semibold normal-case"
              >
                {copiedType === 'email' ? 'Copiado!' : 'Copiar E-mail'}
              </Button>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Suporte TI Corporativo
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {corporateItSupport || ''}
                </span>
              </div>
            </div>
          </div>

          {/* Formatted Message Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mensagem Pré-Formatada para Envio:
              </span>
              <Button
                size="small"
                variant={copiedType === 'message' ? 'contained' : 'text'}
                color={copiedType === 'message' ? 'success' : 'primary'}
                startIcon={copiedType === 'message' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={handleCopyMessage}
                className="text-xs font-semibold normal-case py-0.5"
              >
                {copiedType === 'message' ? 'Mensagem Copiada!' : 'Copiar Mensagem'}
              </Button>
            </div>
            <div className="p-3 bg-slate-950 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap border border-slate-800 select-all max-h-40 overflow-y-auto leading-relaxed">
              {formattedMessage}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
              💡 Dica: Copie a mensagem acima para colar diretamente no seu cliente de e-mail corporativo (Outlook, Webmail, Teams ou chamado interno de TI).
            </span>
          </div>
        </DialogContent>

        <DialogActions className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {!unlockRequested && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<Send className="w-3.5 h-3.5" />}
                onClick={handleSendUnlockRequest}
                className="font-bold text-xs normal-case"
              >
                Registrar Pedido no Sistema
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={handleSafeOpenEmail}
              className="text-xs normal-case"
              title="Abre o cliente de e-mail externo em nova aba do navegador"
            >
              Abrir no Aplicativo de E-mail
            </Button>
          </div>

          <Button
            onClick={() => setContactModalOpen(false)}
            color="inherit"
            size="small"
            className="font-semibold text-xs"
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
