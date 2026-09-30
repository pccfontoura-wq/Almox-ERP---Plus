import React, { useState } from 'react';
import {
  Box, Typography, Card, TextField, Button,
  Switch, FormControlLabel, Alert, Divider
} from '@mui/material';
import { Save } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';

export const Configuracoes: React.FC = () => {
  const { currentUser } = useAuth();

  const [companyName, setCompanyName] = useState('Almox Plus Enterprise');
  const [cnpj, setCnpj] = useState('12.345.678/0001-90');
  const [smtpServer, setSmtpServer] = useState('smtp.office365.com');
  const [smtpPort, setSmtpPort] = useState('587');

  const [enableEmailAlerts, setEnableEmailAlerts] = useState(true);
  const [enableAutoPO, setEnableAutoPO] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <Box className="space-y-6">
      <Breadcrumb items={[{ label: 'Configurações Globais do Sistema' }]} />

      {savedSuccess && (
        <Alert severity="success">
          Configurações salvas com sucesso no banco de dados!
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base">
            Dados da Organização
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <TextField
                fullWidth
                label="Razão Social"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <TextField
                fullWidth
                label="CNPJ Matriz"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base">
            Parâmetros de Estoque e Compras
          </Typography>

          <div className="space-y-3">
            <FormControlLabel
              control={
                <Switch
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  disabled // Blocked by business rule
                />
              }
              label={
                <div>
                  <Typography variant="subtitle2" className="font-bold text-xs">
                    Permitir Saldo de Estoque Negativo
                  </Typography>
                  <Typography variant="caption" className="text-rose-600 dark:text-rose-400 text-[11px] block">
                    🔒 Trava de Segurança Corporativa Ativa: Não é permitido estoque negativo no Almox Plus.
                  </Typography>
                </div>
              }
            />

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={enableAutoPO}
                  onChange={(e) => setEnableAutoPO(e.target.checked)}
                />
              }
              label={
                <div>
                  <Typography variant="subtitle2" className="font-bold text-xs">
                    Gerar Cotações Automaticamente quando Estoque Mínimo for Atingido
                  </Typography>
                  <Typography variant="caption" className="text-slate-500 text-[11px] block">
                    Dispara minutas de Ordem de Compra para aprovação gerencial.
                  </Typography>
                </div>
              }
            />

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={enableEmailAlerts}
                  onChange={(e) => setEnableEmailAlerts(e.target.checked)}
                />
              }
              label={
                <div>
                  <Typography variant="subtitle2" className="font-bold text-xs">
                    Notificações de Validade e Ruptura por E-mail
                  </Typography>
                  <Typography variant="caption" className="text-slate-500 text-[11px] block">
                    Envia boletim diário para os gestores da unidade afetada.
                  </Typography>
                </div>
              }
            />
          </div>
        </Card>

        <Card className="rounded-xl border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <Typography variant="h6" className="font-bold text-slate-900 dark:text-slate-100 text-base">
            Configuração de Servidor de E-mail (SMTP)
          </Typography>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <TextField
                fullWidth
                label="Servidor SMTP Host"
                value={smtpServer}
                onChange={(e) => setSmtpServer(e.target.value)}
              />
            </div>
            <div>
              <TextField
                fullWidth
                label="Porta SMTP"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Box className="flex justify-end">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<Save className="w-4 h-4" />}
            disabled={currentUser?.role === 'Visitante'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6"
          >
            Salvar Parâmetros do Sistema
          </Button>
        </Box>
      </form>
    </Box>
  );
};
