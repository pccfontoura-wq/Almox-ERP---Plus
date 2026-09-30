import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Avatar, Chip, CircularProgress, Tooltip, IconButton, Divider
} from '@mui/material';
import { Bot, Send, Sparkles, User, Plus, Trash2, Download, MessageSquare, RefreshCw } from 'lucide-react';

import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Breadcrumb } from '../components/Breadcrumb';

interface ChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  messages: ChatMessage[];
}

export const AssistenteIA: React.FC = () => {
  const { currentUser } = useAuth();
  const { selectedBranch } = useApp();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'sess-1',
      title: 'Análise de Reposição e Compras',
      createdAt: new Date(),
      messages: [
        {
          id: '1',
          sender: 'AI',
          text: `Olá, ${currentUser?.name || 'Gestor'}! Sou o Assistente IA do Almox Plus. Tenho acesso completo aos dados do ERP para a unidade ${selectedBranch}. Como posso apoiar suas decisões de estoque ou compras hoje?`,
          timestamp: new Date()
        }
      ]
    },
    {
      id: 'sess-2',
      title: 'Diagnóstico Curva ABC',
      createdAt: new Date(Date.now() - 86400000),
      messages: [
        {
          id: '101',
          sender: 'USER',
          text: 'Quais itens da curva A possuem menor cobertura de dias no almoxarifado?',
          timestamp: new Date(Date.now() - 86400000)
        },
        {
          id: '102',
          sender: 'AI',
          text: 'Identifiquei que os produtos EPI-001 (Capacete de Segurança) e FER-001 (Jogo de Chaves Soquete) possuem apenas 5 e 8 dias de cobertura na unidade SP. Recomendo abrir cotação com os fornecedores homologados.',
          timestamp: new Date(Date.now() - 86350000)
        }
      ]
    }
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string>('sess-1');

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const quickPrompts = [
    '📊 Gere um relatório executivo para apresentação da diretoria.',
    '⚠️ Quais produtos apresentam risco inminente de ruptura de estoque?',
    '🚚 Recomende redistribuição inteligente entre unidades (RJ, SJRP, SP, BSB).',
    '📦 Quais itens estão estagnados há mais de 60 dias sem movimentação?',
    '🏷️ Quais patrimônios estão sem responsável e necessitam de inventário?'
  ];

  const handleNewSession = () => {
    const newSess: ChatSession = {
      id: `sess-${Date.now()}`,
      title: 'Nova Consulta IA',
      createdAt: new Date(),
      messages: [
        {
          id: Date.now().toString(),
          sender: 'AI',
          text: `Nova conversa iniciada. Estou pronto para analisar os dados de estoque e compras do ERP Almox Plus.`,
          timestamp: new Date()
        }
      ]
    };
    setSessions([newSess, ...sessions]);
    setActiveSessionId(newSess.id);
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'USER',
      text: textToSend,
      timestamp: new Date()
    };

    // Update session title if first prompt
    const isFirstUserMsg = activeSession.messages.filter(m => m.sender === 'USER').length === 0;
    const updatedTitle = isFirstUserMsg ? (textToSend.length > 28 ? textToSend.substring(0, 28) + '...' : textToSend) : activeSession.title;

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          title: updatedTitle,
          messages: [...s.messages, userMsg]
        };
      }
      return s;
    }));

    if (!queryText) setInput('');
    setLoading(true);

    try {
      const state = dataService.getState();
      const productsContext = state.products.map(p => ({
        sku: p.code,
        nome: p.name,
        categoria: p.category,
        estoqueLocal: p.stockByBranch[selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch] || 0,
        min: p.minStock,
        preco: p.unitPrice
      }));

      const summaryData = {
        totalProducts: state.products.length,
        pendingRequisitions: state.requisitions.filter(r => r.status === 'PENDENTE').length,
        openPurchaseOrders: state.purchaseOrders.filter(po => po.status !== 'ENTREGUE').length,
        inTransitTransfers: state.transfers.filter(t => t.status === 'EM_TRANSITO').length
      };

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          context: {
            user: currentUser?.name,
            role: currentUser?.role,
            branch: selectedBranch,
            summaryData,
            products: productsContext.slice(0, 15)
          }
        })
      });

      const data = await response.json();
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'AI',
        text: data.reply || 'Desculpe, não consegui processar a análise no momento.',
        timestamp: new Date()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, aiMsg]
          };
        }
        return s;
      }));
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'AI',
        text: 'Ocorreu um erro ao conectar ao serviço do assistente IA. Verifique sua conexão e tente novamente.',
        timestamp: new Date()
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, errorMsg] };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: [
            {
              id: Date.now().toString(),
              sender: 'AI',
              text: 'Histórico desta conversa limpo. Como posso ajudar agora?',
              timestamp: new Date()
            }
          ]
        };
      }
      return s;
    }));
  };

  const handleExportChat = () => {
    const textContent = activeSession.messages.map(m => `[${m.timestamp.toLocaleString('pt-BR')}] ${m.sender === 'USER' ? 'Usuário' : 'Assistente IA'}:\n${m.text}\n`).join('\n---\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AlmoxPlus_IA_Conversa_${activeSession.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box className="space-y-4 max-w-7xl mx-auto">
      <Breadcrumb items={[{ label: 'Assistente IA (Consultoria Estratégica)' }]} />

      {/* Top Banner */}
      <Box className="flex items-center justify-between gap-3 bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-md">
        <div className="flex items-center gap-3">
          <Box className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300">
            <Bot className="w-6 h-6" />
          </Box>
          <div>
            <Typography variant="h6" className="font-extrabold tracking-tight">
              Assistente IA Almox Plus (Gemini 3.6 Flash)
            </Typography>
            <Typography variant="body2" className="text-purple-200 text-xs">
              Análise em tempo real de estoque, compras, curva ABC e otimização de unidades.
            </Typography>
          </div>
        </div>
        <Chip
          icon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
          label={`Unidade: ${selectedBranch}`}
          size="small"
          className="bg-purple-800/60 text-purple-100 font-bold text-xs"
        />
      </Box>

      {/* ChatGPT Layout (Left history, Right active chat) */}
      <Box className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[600px]">
        {/* Left Sidebar: Session History */}
        <Card className="md:col-span-1 rounded-2xl border-slate-200 dark:border-slate-800 flex flex-col h-full bg-slate-50 dark:bg-slate-900/60">
          <Box className="p-3 border-b border-slate-200 dark:border-slate-800">
            <Button
              fullWidth
              variant="contained"
              startIcon={<Plus className="w-4 h-4" />}
              onClick={handleNewSession}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 rounded-xl shadow-xs"
            >
              Nova Conversa
            </Button>
          </Box>

          <Box className="flex-1 overflow-y-auto p-2 space-y-1">
            <Typography variant="caption" className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Histórico de Consultas
            </Typography>
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => setActiveSessionId(sess.id)}
                  className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 font-bold border border-purple-300 dark:border-purple-800'
                      : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                    <span className="truncate">{sess.title}</span>
                  </div>
                </div>
              );
            })}
          </Box>
        </Card>

        {/* Right Panel: Chat Interface */}
        <Card className="md:col-span-3 rounded-2xl border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden">
          {/* Chat Header */}
          <Box className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-600" />
              <div>
                <Typography variant="subtitle2" className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  {activeSession.title}
                </Typography>
                <Typography variant="caption" className="text-[10px] text-slate-500 block">
                  {activeSession.messages.length} mensagens na sessão
                </Typography>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip title="Exportar Conversa (.txt)">
                <IconButton size="small" onClick={handleExportChat} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Download className="w-4 h-4" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Limpar conversa atual">
                <IconButton size="small" onClick={handleClearChat} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </Tooltip>
            </div>
          </Box>

          {/* Messages Area */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
            {activeSession.messages.map((msg) => (
              <Box
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'USER' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className={`w-8 h-8 text-xs font-bold ${msg.sender === 'USER' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                  {msg.sender === 'USER' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </Avatar>
                <div className={`max-w-2xl p-3.5 rounded-2xl text-xs md:text-sm shadow-xs ${
                  msg.sender === 'USER'
                    ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-800 leading-relaxed whitespace-pre-wrap'
                }`}>
                  {msg.text}
                  <Typography variant="caption" className={`block mt-1.5 text-[9px] ${msg.sender === 'USER' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </div>
              </Box>
            ))}

            {loading && (
              <Box className="flex items-center gap-2 text-purple-600 font-semibold text-xs p-2 bg-purple-50 dark:bg-purple-950/30 rounded-xl w-fit">
                <CircularProgress size={16} color="inherit" />
                <span>Processando análise estratégica no modelo Gemini 3.6...</span>
              </Box>
            )}
          </CardContent>

          {/* Quick Prompts Bar */}
          <Box className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-1.5 overflow-x-auto">
            {quickPrompts.map((prompt, idx) => (
              <Chip
                key={idx}
                icon={<Sparkles className="w-3 h-3 text-purple-500" />}
                label={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ))}
          </Box>

          {/* Input Bar */}
          <Box className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <TextField
              fullWidth
              size="small"
              placeholder="Pergunte ao assistente sobre compras, estoque mínimo, curva ABC..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={loading}
              className="bg-slate-50 dark:bg-slate-800/60 rounded-xl"
            />
            <Button
              variant="contained"
              onClick={() => handleSendMessage()}
              disabled={loading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 rounded-xl font-bold shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </Box>
        </Card>
      </Box>
    </Box>
  );
};
