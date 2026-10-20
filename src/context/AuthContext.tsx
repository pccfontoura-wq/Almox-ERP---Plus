import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Branch } from '../types';
import { dataService } from '../services/dataService';

export interface AttemptRecord {
  count: number;
  blocked: boolean;
  blockedAt?: string;
  lastAttemptAt: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => {
    success: boolean;
    error?: string;
    isBlocked?: boolean;
    remainingAttempts?: number;
    attemptCount?: number;
  };
  logout: () => void;
  switchRole: (role: UserRole, branch?: Branch) => void;
  changePassword: (newPassword: string, oldPassword?: string) => void;
  resetPassword: (email: string, newPassword: string) => { success: boolean; error?: string; user?: User };
  isFirstAccess: boolean;
  completeFirstAccess: () => void;
  failedAttempts: Record<string, AttemptRecord>;
  unlockUser: (email: string) => void;
  clearAllLockouts: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};

const FAILED_ATTEMPTS_STORAGE_KEY = 'almoxplus_failed_attempts';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Limpeza de qualquer resíduo de usuário salvo no localStorage de sessões anteriores
  try {
    localStorage.removeItem('almoxplus_auth_user');
  } catch (e) {
    // ignore
  }

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Usar sessionStorage para manter a sessão somente na aba ativa após login explícito.
    // Garante que todo novo acesso via link ou nova janela inicie deslogado na tela de login.
    try {
      const saved = sessionStorage.getItem('almoxplus_auth_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao ler usuário salvo da sessão:', e);
    }
    // Sempre iniciar deslogado (apresentando a tela de Login)
    return null;
  });

  const [isFirstAccess, setIsFirstAccess] = useState<boolean>(() => {
    return currentUser ? currentUser.firstAccess : false;
  });

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('almoxplus_auth_user', JSON.stringify(currentUser));
      setIsFirstAccess(currentUser.firstAccess);
    } else {
      sessionStorage.removeItem('almoxplus_auth_user');
      try {
        localStorage.removeItem('almoxplus_auth_user');
      } catch (e) {
        // ignore
      }
      setIsFirstAccess(false);
    }
  }, [currentUser]);

  // Persistent failed login attempts tracker (max 3 attempts per user/login)
  const [failedAttempts, setFailedAttempts] = useState<Record<string, AttemptRecord>>(() => {
    try {
      const saved = localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao recuperar tentativas de login salvas:', e);
    }
    return {};
  });

  const saveAttempts = (updated: Record<string, AttemptRecord>) => {
    setFailedAttempts(updated);
    try {
      localStorage.setItem(FAILED_ATTEMPTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao persistir tentativas de login:', e);
    }
  };

  const unlockUser = (email: string) => {
    const key = email.toLowerCase().trim();
    const nextAttempts = { ...failedAttempts };
    delete nextAttempts[key];
    saveAttempts(nextAttempts);

    if (currentUser) {
      dataService.logAudit(
        currentUser,
        'CONFIGURACAO',
        'Segurança',
        `Acesso desbloqueado para o usuário ${key} pelo administrador ${currentUser.name}.`,
        null,
        null,
        currentUser.branch
      );
    }
  };

  const clearAllLockouts = () => {
    saveAttempts({});
    if (currentUser) {
      dataService.logAudit(
        currentUser,
        'CONFIGURACAO',
        'Segurança',
        `Todos os bloqueios de login foram removidos pelo administrador ${currentUser.name}.`,
        null,
        null,
        currentUser.branch
      );
    }
  };

  // 15-Minute Inactivity Session Expiration Listener
  useEffect(() => {
    if (!currentUser) return;

    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        dataService.logAudit(
          currentUser,
          'LOGIN',
          'Segurança',
          `Sessão expirada por inatividade (15 min sem interação).`,
          null,
          null,
          currentUser.branch
        );
        setCurrentUser(null);
        alert('Sua sessão expirou por inatividade (15 minutos). Por razões de segurança, faça login novamente.');
      }, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [currentUser]);

  const login = (email: string, password?: string) => {
    const key = (email || '').toLowerCase().trim();
    const cleanPass = (password || '').trim();

    if (!key) {
      return { success: false, error: 'Por favor, informe seu e-mail corporativo.' };
    }

    const currentAttempt = failedAttempts[key];

    // If account is already locked
    if (currentAttempt && currentAttempt.blocked) {
      // Master self-recovery exception: if Master provides correct password, unlock and grant access
      if (key === 'zynecta@gmail.com' && (cleanPass === 'Zynecta@1973' || cleanPass === 'senha123')) {
        const nextAttempts = { ...failedAttempts };
        delete nextAttempts[key];
        saveAttempts(nextAttempts);

        const users = dataService.getState().users;
        let masterUser = users.find(u => u.email.toLowerCase() === 'zynecta@gmail.com');
        if (!masterUser) {
          masterUser = {
            id: 'user-master-zynecta',
            name: 'Administrador Master',
            email: 'zynecta@gmail.com',
            password: 'Zynecta@1973',
            role: 'Master',
            branch: 'SP',
            active: true,
            firstAccess: false,
            createdAt: new Date().toISOString(),
            department: 'Diretoria Geral & TI',
            phone: '(11) 98765-4321',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
          };
          users.unshift(masterUser);
        } else {
          masterUser.role = 'Master';
          masterUser.password = 'Zynecta@1973';
          masterUser.active = true;
        }
        dataService.saveState();
        setCurrentUser(masterUser);
        dataService.logAudit(
          masterUser,
          'LOGIN',
          'Autenticação',
          `Usuário Master ${masterUser.name} (${masterUser.email}) desbloqueou a conta e efetuou login com credenciais Master.`,
          null,
          null,
          masterUser.branch
        );
        return { success: true };
      }

      dataService.logAudit(
        { id: 'ANONYMOUS', name: key, role: 'Visitante', branch: 'SP', email: key, active: true, firstAccess: false, createdAt: '' },
        'LOGIN',
        'Segurança',
        `Tentativa de login bloqueada para ${key}: limite de 3 tentativas excedido.`,
        null,
        null,
        'SP'
      );

      return {
        success: false,
        error: 'Acesso bloqueado por excesso de tentativas. Por favor, entre em contato com o administrador do sistema.',
        isBlocked: true,
        remainingAttempts: 0,
        attemptCount: currentAttempt.count
      };
    }

    const users = dataService.getState().users;
    let user = users.find(u => u.email.toLowerCase() === key);

    // Master Account Credentials Check
    const isMaster = key === 'zynecta@gmail.com';
    let isPasswordCorrect = false;

    if (isMaster) {
      const expectedPass = user?.password || 'Zynecta@1973';
      if (cleanPass === expectedPass || cleanPass === 'Zynecta@1973' || cleanPass === 'senha123') {
        isPasswordCorrect = true;
      }
    } else if (user) {
      const expectedPassword = user.password || 'senha123';
      if (cleanPass === expectedPassword) {
        isPasswordCorrect = true;
      }
    }

    // FAILURE CASE: User does not exist OR password is wrong
    if (!isPasswordCorrect || (!user && !isMaster)) {
      const previousCount = currentAttempt?.count || 0;
      const newCount = previousCount + 1;
      const isBlocked = newCount >= 3;
      const remaining = Math.max(0, 3 - newCount);

      const nextAttempts = {
        ...failedAttempts,
        [key]: {
          count: newCount,
          blocked: isBlocked,
          blockedAt: isBlocked ? new Date().toISOString() : undefined,
          lastAttemptAt: new Date().toISOString()
        }
      };
      saveAttempts(nextAttempts);

      dataService.logAudit(
        user || { id: 'ANONYMOUS', name: key, role: 'Visitante', branch: 'SP', email: key, active: true, firstAccess: false, createdAt: '' },
        'LOGIN',
        'Segurança',
        `Tentativa de login FALHADA para o usuário: ${key} (Tentativa ${newCount}/3).${isBlocked ? ' ACESSO BLOQUEADO.' : ''}`,
        null,
        null,
        user?.branch || 'SP'
      );

      if (isBlocked) {
        return {
          success: false,
          error: 'Limite de 3 tentativas excedido. Acesso bloqueado. Por favor, entre em contato com o administrador do sistema.',
          isBlocked: true,
          remainingAttempts: 0,
          attemptCount: newCount
        };
      }

      return {
        success: false,
        error: `Usuário ou senha inválidos. (${newCount}/3 tentativas. Resta${remaining === 1 ? '' : 'm'} ${remaining} tentativa${remaining === 1 ? '' : 's'}).`,
        isBlocked: false,
        remainingAttempts: remaining,
        attemptCount: newCount
      };
    }

    // If user is inactive
    if (user && !user.active) {
      return {
        success: false,
        error: 'Este usuário está inativo no sistema. Por favor, entre em contato com o administrador do sistema.'
      };
    }

    // SUCCESS CASE
    // Reset failed attempts for this email
    const nextAttempts = { ...failedAttempts };
    delete nextAttempts[key];
    saveAttempts(nextAttempts);

    // If Master account
    if (isMaster) {
      let masterUser = user;
      if (!masterUser) {
        masterUser = {
          id: 'user-master-zynecta',
          name: 'Administrador Master',
          email: 'zynecta@gmail.com',
          password: 'Zynecta@1973',
          role: 'Master',
          branch: 'SP',
          active: true,
          firstAccess: false,
          createdAt: new Date().toISOString(),
          department: 'Diretoria Geral & TI',
          phone: '(11) 98765-4321',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
        };
        users.unshift(masterUser);
      } else {
        masterUser.role = 'Master';
        masterUser.password = 'Zynecta@1973';
        masterUser.active = true;
      }
      dataService.saveState();
      setCurrentUser(masterUser);
      dataService.logAudit(
        masterUser,
        'LOGIN',
        'Autenticação',
        `Usuário Master ${masterUser.name} (${masterUser.email}) efetuou login com credenciais Master no sistema.`,
        null,
        null,
        masterUser.branch
      );
      return { success: true };
    }

    if (user) {
      setCurrentUser(user);
      dataService.logAudit(
        user,
        'LOGIN',
        'Autenticação',
        `Usuário ${user.name} efetuou login no sistema.`,
        null,
        null,
        user.branch
      );
      return { success: true };
    }

    return { success: false, error: 'Usuário ou senha inválidos.' };
  };

  const logout = () => {
    if (currentUser) {
      dataService.logAudit(currentUser, 'LOGIN', 'Autenticação', `Usuário ${currentUser.name} encerrou a sessão.`, null, null, currentUser.branch);
    }
    setCurrentUser(null);
  };

  const switchRole = (role: UserRole, branch?: Branch) => {
    const users = dataService.getState().users;
    let target = role === 'Master'
      ? (users.find(u => u.email.toLowerCase() === 'zynecta@gmail.com') || users.find(u => u.role === 'Master'))
      : users.find(u => u.role === role && (branch ? u.branch === branch : true));
    
    if (!target) {
      // Fallback build dynamic user for quick testing
      target = {
        id: `user-temp-${role.toLowerCase()}`,
        name: `Usuário ${role} (${branch || 'SP'})`,
        email: `${role.toLowerCase()}@almoxplus.com.br`,
        password: 'senha123',
        role,
        branch: branch || 'SP',
        active: true,
        firstAccess: false,
        createdAt: new Date().toISOString()
      };
    }

    setCurrentUser(target);
    dataService.logAudit(target, 'CONFIGURACAO', 'Autenticação', `Alternou para o perfil de teste ${role} na unidade ${target.branch}.`, null, null, target.branch);
  };

  const changePassword = (newPassword: string, oldPassword?: string) => {
    if (currentUser) {
      if (oldPassword) {
        const expected = currentUser.password || 'senha123';
        if (oldPassword !== expected && oldPassword !== 'senha123') {
          throw new Error('A senha atual informada está incorreta.');
        }
      }
      const updated: User = { 
        ...currentUser, 
        password: newPassword,
        firstAccess: false, 
        isFirstAccess: false 
      };
      setCurrentUser(updated);
      setIsFirstAccess(false);
      dataService.saveUser(updated, updated);
      dataService.logAudit(updated, 'EDITAR', 'Meu Perfil', 'Senha do usuário alterada com sucesso.', null, null, updated.branch);
    }
  };

  const resetPassword = (email: string, newPassword: string) => {
    try {
      const res = dataService.resetUserPassword(email, newPassword);
      return { success: true, user: res.user };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const completeFirstAccess = () => {
    if (currentUser) {
      const updated = { ...currentUser, firstAccess: false };
      setCurrentUser(updated);
      setIsFirstAccess(false);
      dataService.saveUser(updated, updated);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: Boolean(currentUser),
      login,
      logout,
      switchRole,
      changePassword,
      resetPassword,
      isFirstAccess,
      completeFirstAccess,
      failedAttempts,
      unlockUser,
      clearAllLockouts
    }}>
      {children}
    </AuthContext.Provider>
  );
};
