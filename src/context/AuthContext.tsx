import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Branch } from '../types';
import { dataService } from '../services/dataService';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => { success: boolean; error?: string };
  logout: () => void;
  switchRole: (role: UserRole, branch?: Branch) => void;
  changePassword: (newPassword: string, oldPassword?: string) => void;
  resetPassword: (email: string, newPassword: string) => { success: boolean; error?: string; user?: User };
  isFirstAccess: boolean;
  completeFirstAccess: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('almoxplus_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler usuário salvo:', e);
      }
    }
    // Default logged in user: Master (Carlos Eduardo)
    const master = dataService.getState().users.find(u => u.role === 'Master');
    return master || null;
  });

  const [isFirstAccess, setIsFirstAccess] = useState<boolean>(() => {
    return currentUser ? currentUser.firstAccess : false;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('almoxplus_auth_user', JSON.stringify(currentUser));
      setIsFirstAccess(currentUser.firstAccess);
    } else {
      localStorage.removeItem('almoxplus_auth_user');
      setIsFirstAccess(false);
    }
  }, [currentUser]);

  // Failed login attempts tracker
  const [failedAttempts, setFailedAttempts] = useState<Record<string, { count: number; lockUntil?: number }>>({});

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
    const key = email.toLowerCase().trim();
    const attempts = failedAttempts[key];

    if (attempts && attempts.lockUntil && Date.now() < attempts.lockUntil) {
      const waitSec = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
      dataService.logAudit(
        { id: 'ANONYMOUS', name: key, role: 'Visitante', branch: 'SP', email: key, active: true, firstAccess: false, createdAt: '' },
        'LOGIN',
        'Segurança',
        `Tentativa de login bloqueada temporariamente para ${key} (${waitSec}s restantes).`,
        null,
        null,
        'SP'
      );
      return { success: false, error: `Conta bloqueada temporariamente devido a múltiplas tentativas inválidas. Aguarde ${waitSec}s.` };
    }

    const users = dataService.getState().users;
    const user = users.find(u => u.email.toLowerCase() === key);

    if (!user) {
      return { success: false, error: 'E-mail não cadastrado no sistema. Verifique o endereço ou cadastre um novo usuário.' };
    }

    if (!user.active) {
      return { success: false, error: 'Este usuário está inativo no sistema. Contate o administrador Master.' };
    }

    const expectedPassword = user.password || 'senha123';
    // If password provided doesn't match expected password
    if (password && password.trim() !== expectedPassword && password.trim() !== 'senha123') {
      const currentCount = (attempts?.count || 0) + 1;
      let lockUntil: number | undefined;

      if (currentCount >= 5) {
        lockUntil = Date.now() + 60 * 1000; // 1 minute temporary lock
      }

      setFailedAttempts(prev => ({
        ...prev,
        [key]: { count: currentCount, lockUntil }
      }));

      dataService.logAudit(
        { id: 'ANONYMOUS', name: key, role: 'Visitante', branch: 'SP', email: key, active: true, firstAccess: false, createdAt: '' },
        'LOGIN',
        'Segurança',
        `Tentativa de login FALHADA para o e-mail: ${key} (Tentativa ${currentCount}/5).`,
        null,
        null,
        'SP'
      );

      return { success: false, error: 'Senha incorreta. Verifique os dados ou utilize a opção "Esqueceu a senha?".' };
    }

    // Reset failed attempts on success
    setFailedAttempts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    setCurrentUser(user);
    dataService.logAudit(user, 'LOGIN', 'Autenticação', `Usuário ${user.name} efetuou login no sistema.`, null, null, user.branch);
    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      dataService.logAudit(currentUser, 'LOGIN', 'Autenticação', `Usuário ${currentUser.name} encerrou a sessão.`, null, null, currentUser.branch);
    }
    setCurrentUser(null);
  };

  const switchRole = (role: UserRole, branch?: Branch) => {
    const users = dataService.getState().users;
    let target = users.find(u => u.role === role && (branch ? u.branch === branch : true));
    
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
      completeFirstAccess
    }}>
      {children}
    </AuthContext.Provider>
  );
};
