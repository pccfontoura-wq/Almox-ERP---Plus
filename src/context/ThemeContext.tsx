import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';

interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {}
});

export const useThemeContext = () => useContext(ThemeContext);

export const CustomThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('almoxplus_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    localStorage.setItem('almoxplus_theme', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#0f172a', // Deep Navy MD3
            light: '#334155',
            dark: '#020617',
            contrastText: '#ffffff'
          },
          secondary: {
            main: '#2563eb', // Royal Accent
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff'
          },
          background: {
            default: mode === 'light' ? '#f8fafc' : '#090d16',
            paper: mode === 'light' ? '#ffffff' : '#111827'
          },
          text: {
            primary: mode === 'light' ? '#0f172a' : '#f8fafc',
            secondary: mode === 'light' ? '#475569' : '#94a3b8'
          },
          error: { main: '#dc2626' },
          warning: { main: '#d97706' },
          success: { main: '#16a34a' },
          info: { main: '#0284c7' }
        },
        typography: {
          fontFamily: '"Plus Jakarta Sans", "Roboto", "Segoe UI", sans-serif',
          button: { textTransform: 'none', fontWeight: 600 },
          h5: { fontWeight: 700 },
          h6: { fontWeight: 600 }
        },
        shape: {
          borderRadius: 10
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                boxShadow: mode === 'light' 
                  ? '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)'
                  : '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
                border: mode === 'light' ? '1px solid #e2e8f0' : '1px solid #1f2937'
              }
            }
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                boxShadow: 'none',
                fontWeight: 700,
                '&:hover': {
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }
              },
              contained: {
                color: '#ffffff !important',
                '&:hover': {
                  color: '#ffffff !important'
                }
              }
            }
          }
        }
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const ThemeContextProvider = CustomThemeProvider;
