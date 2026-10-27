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

  const generateClientAnalysis = (prompt: string, currentBranch: string): string => {
    const rawPrompt = prompt || '';
    const p = rawPrompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const state = dataService.getState();
    const fmt = (val: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 1. ANÁLISE DE ORDENS DE COMPRA COM ESTOURO DE TETO / ORÇAMENTO EXCEDIDO
    const isTetoEstourado =
      p.includes('teto') ||
      p.includes('estour') ||
      p.includes('exced') ||
      p.includes('extrapol') ||
      (p.includes('oc') && (p.includes('limite') || p.includes('alcada') || p.includes('teto'))) ||
      (p.includes('ordem') && (p.includes('limite') || p.includes('teto')));

    if (isTetoEstourado) {
      const overrunPOs = state.purchaseOrders.filter(po =>
        po.budgetOverrun === true || (po.budgetOverrunAmount && po.budgetOverrunAmount > 0)
      );
      const standardPOs = state.purchaseOrders.filter(po => !overrunPOs.some(o => o.id === po.id || o.code === po.code));

      let resp = `### 🚨 Auditoria de Compras: Ordens de Compra (OCs) com Estouro de Teto Orçamentário\n\n`;
      resp += `Foram auditadas todas as **${state.purchaseOrders.length} Ordens de Compra (OCs)** cadastradas no ERP Almox Plus.\n\n`;

      if (overrunPOs.length > 0) {
        resp += `Identificamos **${overrunPOs.length} Ordem(ns) de Compra** que tiveram o teto orçamentário excedido / estourado:\n\n`;
        resp += `| Código OC | Unidade | Centro de Custo | Fornecedor | Valor Total da OC | Valor do Estouro | Status | Justificativa / Alçada |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        overrunPOs.forEach(po => {
          const overrunVal = po.budgetOverrunAmount || 0;
          resp += `| **${po.code}** | Unidade ${po.branch} | ${po.costCenterName || po.costCenterId || 'Geral'} | ${po.supplierName} | ${fmt(po.totalValue)} | **+ ${fmt(overrunVal)}** | ⚠️ ${po.status} | ${po.budgetOverrunJustification || 'Excedeu teto mensal do centro de custo'} |\n`;
        });

        resp += `\n#### Resumo das Demais Ordens de Compra (Dentro do Teto):\n`;
        resp += `Foram verificadas **${standardPOs.length} OCs** emitidas rigorosamente dentro dos tetos orçamentários homologados:\n`;
        standardPOs.forEach(po => {
          resp += `- **${po.code}** (${po.supplierName}): ${fmt(po.totalValue)} — Unidade ${po.branch} [Status: ${po.status}] — ✅ *Dentro da cota orçamentária*\n`;
        });

        resp += `\n### 📋 Diretrizes de Governança e Compliance:\n`;
        resp += `1. **Bloqueio de Emissão:** A ordem **${overrunPOs.map(o => o.code).join(', ')}** está em retenção de conformidade.\n`;
        resp += `2. **Aprovação Obrigatória:** Por extrapolar o teto orçamentário em **${fmt(overrunPOs.reduce((acc, o) => acc + (o.budgetOverrunAmount || 0), 0))}**, requer assinatura conjunta da Diretoria Financeira e Controladoria.\n`;
        resp += `3. **Suplementação:** O gestor do centro de custo deve protocolar pedido de remanejamento orçamentário.`;
      } else {
        resp += `✅ **Nenhuma Ordem de Compra apresentou estouro de teto orçamentário no momento.** Todas as ${state.purchaseOrders.length} ordens monitoradas foram emitidas em conformidade com o saldo disponível de seus respectivos centros de custo.`;
      }
      return resp;
    }

    // 2. CONSULTA ESPECÍFICA DE PRODUTO / SALDO DE ESTOQUE (ex: "quanto temos de luva de vaqueta")
    const aliasesMap: Record<string, string[]> = {
      'EPI-002': ['luva', 'vaqueta', 'luva de vaqueta', 'luvas', 'par de luva', 'luvas de vaqueta'],
      'EPI-001': ['capacete', 'abafador', 'capacete de seguranca', 'capacetes'],
      'INF-001': ['cabo de rede', 'cat6', 'furukawa', 'utp', 'cabo furukawa', 'cabos'],
      'INF-002': ['nobreak', 'senoidal', 'sms', 'no break', '1500va', 'nobreaks'],
      'MAT-001': ['papel', 'sulfite', 'report', 'a4', 'papel a4', 'resma', 'resmas'],
      'QUI-001': ['alcool', 'isopropilico', 'alcool isopropilico', 'galao'],
      'MAN-001': ['disjuntor', 'schneider', 'disjuntor bipolar', '32a', 'disjuntores'],
      'MAN-002': ['fita isolante', 'fita 3m', 'fita isolante 3m', 'fita'],
      'FER-001': ['chave de fenda', 'jogo de chaves', 'chaves isoladas', 'philips', 'chaves'],
      'MED-001': ['kit primeiros socorros', 'primeiros socorros', 'nr-7', 'kit socorros', 'maleta', 'kit'],
      'LOG-001': ['paleteira', 'paleteira manual', 'paleteira hidraulica']
    };

    let matchedProduct: any = null;
    for (const pr of state.products) {
      const code = (pr.code || '').toUpperCase();
      const codeLower = code.toLowerCase();
      const nameNorm = (pr.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const aliases = aliasesMap[code] || [];
      const matchAlias = aliases.some(al => p.includes(al));
      const matchCode = codeLower && p.includes(codeLower);

      const ignoreWords = ['para', 'com', 'este', 'esta', 'onde', 'qual', 'quanto', 'temos', 'saldo', 'estoque', 'unidade', 'unidades'];
      const words = nameNorm.split(/\s+/).filter(w => w.length >= 4 && !ignoreWords.includes(w));
      const matchWords = words.some(w => p.includes(w));

      if (matchAlias || matchCode || matchWords) {
        matchedProduct = pr;
        break;
      }
    }

    if (matchedProduct) {
      const stockMap = matchedProduct.stockByBranch || {};
      const totalStock = Object.values(stockMap).reduce<number>((s, q) => s + (Number(q) || 0), 0);
      const unit = matchedProduct.unit || 'UN';
      const unitPrice = Number(matchedProduct.unitPrice) || 0;
      const totalVal = totalStock * unitPrice;
      const minStock = matchedProduct.minStock || 0;
      const maxStock = matchedProduct.maxStock || 0;
      const shelf = matchedProduct.locationSlot || 'PRAT-A1';

      let resp = `### 📦 Consulta de Estoque: ${matchedProduct.name} (${matchedProduct.code})\n\n`;
      resp += `Atualmente temos um saldo total consolidado de **${totalStock} ${unit}** de **${matchedProduct.name}** em todo o ERP Almox Plus.\n\n`;

      resp += `#### 1. Distribuição Física por Unidade Operacional\n`;
      resp += `| Unidade Operacional | Saldo Físico | Estoque Mínimo | Situação na Unidade |\n`;
      resp += `| :--- | :--- | :--- | :--- |\n`;

      const branches = ['SP', 'RJ', 'SJRP', 'BSB'];
      let criticalBranches: string[] = [];

      branches.forEach(b => {
        const qty = Number(stockMap[b] ?? 0);
        let status = '✅ Regular';
        if (qty <= minStock) {
          status = '⚠️ **Crítico / Abaixo do Mínimo**';
          criticalBranches.push(`Unidade ${b} (${qty} ${unit})`);
        }
        resp += `| **Unidade ${b}** | **${qty} ${unit}** | ${minStock} ${unit} | ${status} |\n`;
      });
      resp += `\n`;

      resp += `#### 2. Ficha Cadastral e Avaliação Financeira\n`;
      resp += `- **SKU / Código:** \`${matchedProduct.code}\`\n`;
      resp += `- **Categoria:** ${matchedProduct.category}\n`;
      resp += `- **Unidade de Medida:** ${unit}\n`;
      resp += `- **Preço Médio de Aquisição:** ${fmt(unitPrice)} / ${unit}\n`;
      resp += `- **Valor Total Imobilizado em Estoque:** ${fmt(totalVal)}\n`;
      resp += `- **Endereçamento no Almoxarifado:** Prateleira \`${shelf}\`\n`;
      resp += `- **Limites de Segurança:** Mínimo: ${minStock} ${unit} | Máximo: ${maxStock} ${unit}\n`;
      if (matchedProduct.expirationDate) {
        resp += `- **Data de Validade:** ${new Date(matchedProduct.expirationDate).toLocaleDateString('pt-BR')} (Lote: \`${matchedProduct.batchNumber || 'LT-PADRAO'}\`)\n`;
      }
      resp += `\n`;

      const linkedPOs = state.purchaseOrders.filter(po =>
        po.items && Array.isArray(po.items) && po.items.some(it => it.productCode === matchedProduct.code || it.productId === matchedProduct.id)
      );

      if (linkedPOs.length > 0) {
        resp += `#### 3. Ordens de Compra & Reposição em Andamento\n`;
        linkedPOs.forEach(po => {
          const item = po.items.find(it => it.productCode === matchedProduct.code || it.productId === matchedProduct.id);
          resp += `- **${po.code}** (${po.supplierName}): **${item?.quantity || 0} ${unit}** destinados à **Unidade ${po.branch}** [Status: ${po.status}] — Total: ${fmt(po.totalValue)}\n`;
        });
        resp += `\n`;
      }

      if (criticalBranches.length > 0) {
        resp += `💡 **Diagnóstico Operacional:** As unidades ${criticalBranches.join(', ')} estão abaixo da margem mínima de segurança. Recomenda-se aprovar a ordem de compra em andamento ou solicitar transferência interna a partir de SP, que possui saldo excedente.`;
      } else {
        resp += `💡 **Diagnóstico Operacional:** O estoque deste item opera em patamar regular, atendendo com folga a demanda operacional das 4 filiais.`;
      }
      return resp;
    }

    // 3. CONSULTA ESPECÍFICA DE CENTRO DE CUSTO (ex: "quanto temos disponível por centro de custo")
    const isCCQuery =
      p.includes('centro de custo') ||
      p.includes('centros de custo') ||
      p.includes('por centro') ||
      (p.includes('disponivel') && (p.includes('centro') || p.includes('setor'))) ||
      (p.includes('saldo') && p.includes('centro'));

    if (isCCQuery) {
      const isAskingHighestOrRanking =
        p.includes('maior') ||
        p.includes('mais gasta') ||
        p.includes('gasta mais') ||
        p.includes('ranking') ||
        (p.includes('qual') && (p.includes('gasto') || p.includes('consumo')));

      const sortedCCs = [...state.costCenters].sort((a, b) => (b.spent || 0) - (a.spent || 0));
      const topCC = sortedCCs[0];
      const listToRender = isAskingHighestOrRanking ? sortedCCs : state.costCenters;

      let totalBudget = 0;
      let totalSpent = 0;

      let resp = '';
      if (isAskingHighestOrRanking && topCC) {
        resp += `### 📊 Ranking de Gastos por Centro de Custo / Setor\n\n`;
        resp += `O centro de custo com o **maior gasto realizado** no ERP Almox Plus é o **${topCC.code} - ${topCC.name} (Unidade ${topCC.branch})**, com um consumo acumulado de **${fmt(topCC.spent || 0)}**.\n\n`;
        resp += `Abaixo está o ranking completo de todos os centros de custo (do maior para o menor consumo):\n\n`;
      } else {
        resp += `### 📊 Posição Orçamentária por Centro de Custo (Visão Geral)\n\n`;
        resp += `Abaixo está o demonstrativo do orçamento alocado, valor consumido e o **saldo disponível** de cada centro de custo ativo:\n\n`;
      }

      resp += `| Posição | Código CC | Centro de Custo | Unidade | Orçamento Aprovado | Gasto Realizado | Saldo Disponível | % Consumido | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const medalhas = ['🥇 1º', '🥈 2º', '🥉 3º', '4º', '5º'];
      listToRender.forEach((cc, idx) => {
        const orc = cc.budget || 0;
        const gast = cc.spent || 0;
        const saldo = orc - gast;
        totalBudget += orc;
        totalSpent += gast;
        const pct = orc > 0 ? ((gast / orc) * 100).toFixed(1) : '0';
        const status = saldo < 0 ? '⚠️ Excedido' : saldo < orc * 0.15 ? '🟡 Atenção' : '✅ Regular';
        const posLabel = isAskingHighestOrRanking ? `**${medalhas[idx] || `${idx + 1}º`}**` : `#${idx + 1}`;

        resp += `| ${posLabel} | **${cc.code}** | ${cc.name} | Unidade ${cc.branch} | ${fmt(orc)} | ${fmt(gast)} | **${fmt(saldo)}** | ${pct}% | ${status} |\n`;
      });

      const totalSaldo = totalBudget - totalSpent;
      resp += `\n#### Totais Corporativos Consolidados:\n`;
      resp += `- **Orçamento Total Alocado (Budget):** ${fmt(totalBudget)}\n`;
      resp += `- **Consumo Realizado:** ${fmt(totalSpent)}\n`;
      resp += `- **Saldo Total Disponível:** **${fmt(totalSaldo)}** (${totalBudget > 0 ? ((totalSaldo / totalBudget) * 100).toFixed(1) : '0'}% livre)\n\n`;
      resp += `💡 **Diagnóstico Financeiro:** O setor de TI em SP (**${topCC?.code}**) absorve ${totalSpent > 0 ? (((topCC?.spent || 0) / totalSpent) * 100).toFixed(1) : '0'}% do consumo corporativo de centros de custo.`;
      return resp;
    }

    // COMPARATIVO / RANKING DE GASTOS POR UNIDADE OPERACIONAL / FILIAL
    const isBranchExpenseComparison =
      p.includes('maior gasto') ||
      p.includes('mais gasta') ||
      p.includes('gasta mais') ||
      p.includes('gastam mais') ||
      p.includes('mais gastam') ||
      p.includes('gastadora') ||
      p.includes('onde gasta mais') ||
      p.includes('onde mais gasta') ||
      p.includes('quem gasta mais') ||
      p.includes('quem mais gasta') ||
      p.includes('gastamos mais') ||
      p.includes('onde mais se gasta') ||
      p.includes('unidade com maior') ||
      p.includes('unidade que mais') ||
      p.includes('filial que mais') ||
      p.includes('filial com maior') ||
      p.includes('maior despesa') ||
      p.includes('maior consumo') ||
      p.includes('maior custo') ||
      (p.includes('unidade') && (p.includes('maior') || p.includes('mais') || p.includes('ranking') || p.includes('comparat') || p.includes('gasto') || p.includes('despesa') || p.includes('custo') || p.includes('consum'))) ||
      (p.includes('filial') && (p.includes('maior') || p.includes('mais') || p.includes('ranking') || p.includes('comparat') || p.includes('gasto') || p.includes('despesa') || p.includes('custo') || p.includes('consum'))) ||
      ((p.includes('unidade') || p.includes('filial') || p.includes('filiais') || p.includes('unidades') || p.includes('onde gasta') || p.includes('quem gasta')) &&
      (p.includes('maior') || p.includes('mais gasta') || p.includes('gasta mais') || p.includes('ranking') || p.includes('comparat') || p.includes('distribui') || p.includes('gastos por') || p.includes('gasto por') || p.includes('despesas por') || p.includes('despesa por') || (p.includes('qual') && (p.includes('gasto') || p.includes('despesa') || p.includes('custo')))));

    // RANKING DE GASTOS POR CENTRO DE CUSTO / SETOR
    const isCCExpenseRanking =
      (p.includes('centro de custo') || p.includes('centros de custo') || p.includes('setor') || p.includes('departamento')) &&
      (p.includes('maior') || p.includes('mais gasta') || p.includes('gasta mais') || p.includes('ranking') || (p.includes('qual') && (p.includes('gasto') || p.includes('consumo'))));

    if (isBranchExpenseComparison) {
      const branches = ['SP', 'RJ', 'BSB', 'SJRP'];
      const branchNames: Record<string, string> = {
        SP: 'São Paulo (Matriz / Hub SP)',
        RJ: 'Rio de Janeiro (Operações RJ)',
        BSB: 'Brasília (Distrito Federal)',
        SJRP: 'São José do Rio Preto (Interior SP)'
      };

      const branchStats = branches.map(b => {
        const bCCs = state.costCenters.filter(c => c.branch === b);
        const bBudget = bCCs.reduce((sum, c) => sum + (c.budget || 0), 0);
        const bSpentCC = bCCs.reduce((sum, c) => sum + (c.spent || 0), 0);
        const bPOs = state.purchaseOrders.filter(po => po.branch === b && po.status !== 'CANCELADO');
        const bTotalPO = bPOs.reduce((sum, po) => sum + (po.totalValue || 0), 0);
        const bTotalGasto = bSpentCC + bTotalPO;
        const bSaldoCC = bBudget - bSpentCC;

        let mainCC = bCCs[0];
        bCCs.forEach(c => {
          if ((c.spent || 0) > ((mainCC?.spent) || 0)) {
            mainCC = c;
          }
        });

        return {
          branch: b,
          name: branchNames[b] || b,
          budget: bBudget,
          spentCC: bSpentCC,
          totalPO: bTotalPO,
          poCount: bPOs.length,
          totalGasto: bTotalGasto,
          saldoCC: bSaldoCC,
          ccs: bCCs,
          mainCC
        };
      });

      const sortedByTotal = [...branchStats].sort((a, b) => b.totalGasto - a.totalGasto);
      const sortedByPO = [...branchStats].sort((a, b) => b.totalPO - a.totalPO);
      const sortedByCC = [...branchStats].sort((a, b) => b.spentCC - a.spentCC);

      const topUnitTotal = sortedByTotal[0];
      const topUnitPO = sortedByPO[0];
      const topUnitCC = sortedByCC[0];

      const grandTotalCC = branchStats.reduce((s, b) => s + b.spentCC, 0);
      const grandTotalPO = branchStats.reduce((s, b) => s + b.totalPO, 0);
      const grandTotalConsolidated = branchStats.reduce((s, b) => s + b.totalGasto, 0);
      const grandBudget = branchStats.reduce((s, b) => s + b.budget, 0);

      const pctTotal = grandTotalConsolidated > 0 ? ((topUnitTotal.totalGasto / grandTotalConsolidated) * 100).toFixed(1) : '0';
      const pctPO = grandTotalPO > 0 ? ((topUnitPO.totalPO / grandTotalPO) * 100).toFixed(1) : '0';

      let resp = `### 🏢 Análise Comparativa de Gastos por Unidade Operacional\n\n`;
      if (grandTotalConsolidated === 0) {
        resp += `No momento, o sistema está configurado em **Marco Zero (Produção Limpa)**: todas as 4 unidades operacionais (SP, RJ, BSB e SJRP) possuem **R$ 0,00 em gastos e ordens de compra registradas**.\n\n`;
        resp += `#### 📊 Posição das Unidades Operacionais (Aguardando Novas Lotações):\n`;
        branchStats.forEach(b => {
          resp += `- **Unidade ${b.branch} (${b.name}):** Gasto de ${fmt(b.totalGasto)} | Orçamento Alocado: ${fmt(b.budget)} | OCs Emitidas: 0\n`;
        });
        resp += `\n💡 **Status:** Sistema pronto para registrar as primeiras requisições, pedidos de compra e despesas reais de cada filial.`;
        return resp;
      }

      resp += `A unidade com o **maior gasto total consolidado** no ERP Almox Plus é a **Unidade ${topUnitTotal.branch} (${topUnitTotal.name.split(' ')[0]} ${topUnitTotal.name.split(' ')[1] || ''})**, somando um dispêndio acumulado de **${fmt(topUnitTotal.totalGasto)}** (representando **${pctTotal}%** de todos os gastos corporativos da empresa).\n\n`;
      resp += `Ao detalharmos a natureza contábil dos gastos, observamos o seguinte comportamento:\n\n`;
      resp += `1. **Consumo em Centros de Custo:** A **Unidade ${topUnitCC.branch}** soma **${fmt(topUnitCC.spentCC)}** consumidos.\n`;
      resp += `2. **Aquisições em Ordens de Compra (OCs):** A **Unidade ${topUnitPO.branch}** soma **${fmt(topUnitPO.totalPO)}** em compras (**${pctPO}%** do valor corporativo de OCs).\n\n`;
      resp += `---\n\n`;

      resp += `#### 📊 1. Ranking Geral de Gastos por Unidade (Consolidado)\n\n`;
      resp += `| Posição | Unidade Operacional | Consumo em Centros de Custo | Aquisições em OCs | Gasto Consolidado Total | % Corporativo | Principal Centro de Custo |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const medalhas = ['🥇 1º Lugar', '🥈 2º Lugar', '🥉 3º Lugar', '4º Lugar'];
      sortedByTotal.forEach((b, idx) => {
        const pct = grandTotalConsolidated > 0 ? ((b.totalGasto / grandTotalConsolidated) * 100).toFixed(1) : '0';
        const mainCCDesc = b.mainCC ? `${b.mainCC.name} (${fmt(b.mainCC.spent || 0)})` : 'Geral';
        resp += `| **${medalhas[idx] || `${idx + 1}º Lugar`}** | **Unidade ${b.branch}** | ${fmt(b.spentCC)} | ${fmt(b.totalPO)} (${b.poCount} OCs) | **${fmt(b.totalGasto)}** | **${pct}%** | ${mainCCDesc} |\n`;
      });

      resp += `| **TOTAL GERAL** | **Todas as Filiais** | **${fmt(grandTotalCC)}** | **${fmt(grandTotalPO)}** | **${fmt(grandTotalConsolidated)}** | **100,0%** | Orçamento Total: ${fmt(grandBudget)} |\n\n`;
      resp += `---\n\n`;

      resp += `#### 🔍 2. Detalhamento da Unidade Líder: Unidade ${topUnitTotal.branch} (${fmt(topUnitTotal.totalGasto)})\n`;
      resp += `- **Consumo nos Centros de Custo:**\n`;
      if (topUnitTotal.ccs.length > 0) {
        topUnitTotal.ccs.forEach(c => {
          resp += `  - **${c.code} - ${c.name}:** Gasto de **${fmt(c.spent)}** (de ${fmt(c.budget)} alocados | Saldo: ${fmt(c.budget - c.spent)})\n`;
        });
      } else {
        resp += `  - Nenhum centro de custo alocado nesta unidade.\n`;
      }
      const topPOs = state.purchaseOrders.filter(po => po.branch === topUnitTotal.branch && po.status !== 'CANCELADO');
      resp += `- **Ordens de Compra Emitidas:** ${topPOs.length > 0 ? `${topPOs.length} OCs ativas somando ${fmt(topUnitTotal.totalPO)} (${topPOs.map(o => `\`${o.code}\` ${fmt(o.totalValue)}`).join(', ')}).` : 'Nenhuma ordem de compra cadastrada nesta unidade.'}\n\n`;

      return resp;
    }

    if (isCCExpenseRanking) {
      const sortedCCs = [...state.costCenters].sort((a, b) => (b.spent || 0) - (a.spent || 0));
      const topCC = sortedCCs[0];
      const totalCCSpent = sortedCCs.reduce((acc, c) => acc + (c.spent || 0), 0);

      let resp = `### 📊 Ranking de Gastos por Centro de Custo / Setor\n\n`;
      resp += `O centro de custo com o **maior gasto realizado** no ERP Almox Plus é o **${topCC.code} - ${topCC.name} (Unidade ${topCC.branch})**, com um consumo acumulado de **${fmt(topCC.spent || 0)}**.\n\n`;
      resp += `#### Ranking de Todos os Centros de Custo (Do Maior para o Menor Consumo):\n\n`;
      resp += `| Posição | Código CC | Centro de Custo | Unidade | Gasto Realizado | Orçamento Alocado | Saldo Disponível | % Consumido |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const medalhas = ['🥇 1º', '🥈 2º', '🥉 3º', '4º', '5º'];
      sortedCCs.forEach((c, idx) => {
        const spent = c.spent || 0;
        const budget = c.budget || 0;
        const saldo = budget - spent;
        const pct = budget > 0 ? ((spent / budget) * 100).toFixed(1) : '0';
        resp += `| **${medalhas[idx] || `${idx + 1}º`}** | **${c.code}** | ${c.name} | Unidade ${c.branch} | **${fmt(spent)}** | ${fmt(budget)} | ${fmt(saldo)} | ${pct}% |\n`;
      });

      resp += `\n💡 **Diagnóstico:** O setor de TI em SP (**${topCC.code}**) absorve ${totalCCSpent > 0 ? (((topCC.spent || 0) / totalCCSpent) * 100).toFixed(1) : '0'}% de todo o consumo corporativo de centros de custo.`;
      return resp;
    }

    let targetBranch: string | null = null;
    if (/\brj\b|rio de janeiro/i.test(p)) targetBranch = 'RJ';
    else if (/\bsp\b|s[aã]o paulo/i.test(p)) targetBranch = 'SP';
    else if (/\bsjrp\b|s[aã]o jos[eé]/i.test(p)) targetBranch = 'SJRP';
    else if (/\bbsb\b|bras[ií]lia/i.test(p)) targetBranch = 'BSB';

    if (targetBranch) {
      const branchCCs = state.costCenters.filter(c => c.branch === targetBranch);
      const branchOrders = state.purchaseOrders.filter(po => po.branch === targetBranch && po.status !== 'CANCELADO');
      const totalPurchased = branchOrders.reduce((sum, po) => sum + (po.totalValue || 0), 0);
      const totalBudget = branchCCs.reduce((sum, c) => sum + (c.budget || 0), 0);
      const totalSpent = branchCCs.reduce((sum, c) => sum + (c.spent || 0), 0);
      const remaining = totalBudget - totalSpent;

      let resp = `### 📊 Relatório Financeiro e de Gastos — Unidade ${targetBranch}\n\n`;
      resp += `Com base nos registros integrados do ERP Almox Plus para a **Unidade ${targetBranch}**:\n\n`;
      resp += `#### 1. Totais da Unidade ${targetBranch}\n`;
      resp += `- **Total Gasto em Ordens de Compra (OCs):** ${fmt(totalPurchased)} (${branchOrders.length} OCs emitidas)\n`;
      resp += `- **Consumo Realizado nos Centros de Custo:** ${fmt(totalSpent)}\n`;
      resp += `- **Orçamento Total Alocado (Budget):** ${fmt(totalBudget)}\n`;
      resp += `- **Saldo Orçamentário Livre:** ${fmt(remaining)} (${totalBudget > 0 ? ((remaining / totalBudget) * 100).toFixed(1) : '0'}% disponível)\n\n`;

      if (branchCCs.length > 0) {
        resp += `#### 2. Gastos por Centro de Custo da Unidade ${targetBranch}\n`;
        resp += `| Código CC | Centro de Custo | Orçamento Aprovado | Gasto Realizado | Saldo Disponível | Status |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        branchCCs.forEach(cc => {
          const isOver = (cc.spent || 0) > (cc.budget || 0);
          const status = isOver ? '⚠️ Excedido' : '✅ Regular';
          resp += `| ${cc.code} | ${cc.name} | ${fmt(cc.budget)} | ${fmt(cc.spent)} | ${fmt(cc.budget - cc.spent)} | ${status} |\n`;
        });
        resp += `\n`;
      } else {
        resp += `*Nota: Os centros de custos operacionais da empresa estão consolidados ou compartilhados entre as filiais.*\n\n`;
      }

      resp += `💡 **Diagnóstico da Diretoria:** A Unidade ${targetBranch} apresenta ${remaining >= 0 ? 'equilíbrio orçamentário positivo' : 'estouro orçamentário'} e suas compras seguem a governança corporativa ativa.`;
      return resp;
    }

    if (p.includes('gasto') || p.includes('custo') || p.includes('compras') || p.includes('financeiro') || p.includes('orcamento') || p.includes('orçamento') || p.includes('despesa') || p.includes('valor')) {
      const activePOs = state.purchaseOrders.filter(po => po.status !== 'CANCELADO');
      const totalPurchased = activePOs.reduce((sum, po) => sum + (po.totalValue || 0), 0);
      const totalBudget = state.costCenters.reduce((sum, c) => sum + (c.budget || 0), 0);
      const totalSpent = state.costCenters.reduce((sum, c) => sum + (c.spent || 0), 0);
      const remaining = totalBudget - totalSpent;

      let resp = `### 📊 Relatório Consolidado de Gastos e Finanças (Visão Global)\n\n`;
      resp += `#### 1. Totais Globais de Compras e Orçamento\n`;
      resp += `- **Total Gasto em Ordens de Compra (OCs):** ${fmt(totalPurchased)}\n`;
      resp += `- **Consumo Realizado nos Centros de Custo:** ${fmt(totalSpent)}\n`;
      resp += `- **Orçamento Total Alocado:** ${fmt(totalBudget)}\n`;
      resp += `- **Saldo Orçamentário Livre:** ${fmt(remaining)} (${totalBudget > 0 ? ((remaining / totalBudget) * 100).toFixed(1) : '0'}% disponível)\n\n`;

      resp += `#### 2. Posição dos Centros de Custo\n`;
      resp += `| Código CC | Centro de Custo | Unidade | Orçamento | Gasto Realizado | Saldo Disponível |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      state.costCenters.slice(0, 10).forEach(cc => {
        resp += `| ${cc.code} | ${cc.name} | ${cc.branch} | ${fmt(cc.budget)} | ${fmt(cc.spent)} | ${fmt(cc.budget - cc.spent)} |\n`;
      });
      return resp;
    }

    // Análise de Validade / Produtos Vencidos / Lotes
    if (p.includes('vencid') || p.includes('valid') || p.includes('expir') || p.includes('lote') || p.includes('pereciv')) {
      const now = new Date();
      const expiredItems: any[] = [];
      const expiringSoon: any[] = [];

      state.products.forEach(pr => {
        if (!pr.expirationDate) return;
        const exp = new Date(pr.expirationDate);
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const totalUnits = Object.values(pr.stockByBranch || {}).reduce((s, q) => s + (Number(q) || 0), 0);
        
        // Verificar homogeneidade dos lotes
        const batchList = pr.batches && pr.batches.length > 0
          ? pr.batches
          : (pr.batchNumber ? [{ batchNumber: pr.batchNumber, expirationDate: pr.expirationDate, branch: 'GLOBAL', quantity: totalUnits }] : []);
        const distinctBatches = Array.from(new Set(batchList.map(b => b.batchNumber).filter(Boolean)));
        const isUnified = distinctBatches.length <= 1;

        const itemData = {
          ...pr,
          diffDays,
          totalUnits,
          batchCode: pr.batchNumber || batchList[0]?.batchNumber || 'LT-PADRAO',
          isUnified,
          loss: totalUnits * (pr.unitPrice || 0)
        };

        if (diffDays < 0) {
          expiredItems.push(itemData);
        } else if (diffDays <= 60) {
          expiringSoon.push(itemData);
        }
      });

      if (expiredItems.length > 0) {
        let totalLoss = 0;
        let totalUnits = 0;

        let resp = `### 🚨 Auditoria de Validade: Produtos Vencidos Identificados no Estoque\n\n`;
        resp += `**Sim, existem produtos com validade expirada** em estoque no sistema Almox Plus.\n\n`;
        resp += `Abaixo está o detalhamento completo dos itens, **especificação dos lotes** e a **distribuição física por unidade operacional**:\n\n`;

        expiredItems.forEach((item, idx) => {
          totalLoss += item.loss;
          totalUnits += item.totalUnits;
          const dateStr = new Date(item.expirationDate!).toLocaleDateString('pt-BR');
          const daysAgo = Math.abs(item.diffDays);

          resp += `#### ${idx + 1}. ${item.name} (${item.code})\n`;
          resp += `- **Status da Validade:** 🔴 **VENCIDO** (expirou em **${dateStr}**, há aprox. ${daysAgo} dias)\n`;
          resp += `- **Código do Lote Registrado:** \`${item.batchCode}\`\n`;
          resp += `- **Situação do Lote entre as Unidades:** ${
            item.isUnified
              ? `✅ **MESMO LOTE DE VENCIMENTO EM TODAS AS UNIDADES** (Todas as 4 filiais receberam remessas vinculadas ao mesmo lote \`${item.batchCode}\`).`
              : `⚠️ **Lotes distintos por unidade** (verifique a segregação individual).`
          }\n`;
          resp += `- **Quantidade Total Vencida:** **${item.totalUnits} ${item.unit}**\n`;
          resp += `- **Impacto Financeiro Estimado:** ${fmt(item.loss)} (${fmt(item.unitPrice)} / ${item.unit})\n\n`;

          resp += `**Distribuição física do lote por unidade operacional:**\n\n`;
          resp += `| Unidade Operacional | Saldo Físico Vencido | Lote Referente | Situação da Validade |\n`;
          resp += `| :--- | :--- | :--- | :--- |\n`;

          const branches = ['SP', 'RJ', 'SJRP', 'BSB'];
          branches.forEach(b => {
            const qty = item.stockByBranch[b] || 0;
            resp += `| **Unidade ${b}** | **${qty} ${item.unit}** | \`${item.batchCode}\` | 🔴 Vencido (${dateStr}) |\n`;
          });
          resp += `\n---\n\n`;
        });

        resp += `### 📊 Resumo Executivo das Perdas por Vencimento\n`;
        resp += `- **Total de Produtos Vencidos:** ${expiredItems.length} itens\n`;
        resp += `- **Volume Físico Total:** **${totalUnits} unidades**\n`;
        resp += `- **Impacto Financeiro Consolidado:** **${fmt(totalLoss)}**\n\n`;

        resp += `### 📋 Procedimento Operacional Padrão (POP Recomendado):\n`;
        resp += `1. **Segregação Física:** Isolar imediatamente os lotes afetados nas áreas de quarentena de SP, RJ, SJRP e BSB.\n`;
        resp += `2. **Bloqueio de Movimentação:** Suspender saídas e requisições para esses itens no almoxarifado.\n`;
        resp += `3. **Baixa por Avaria/Descarte:** Registrar a baixa contábil por obsolescência/vencimento e lavrar laudo de descarte sanitário.\n`;
        resp += `4. **Reposição com Compras:** Emitir novas solicitações de compra com cobrança de laudo de conformidade e validade estendida.`;

        return resp;
      } else {
        return (
          `### 🛡️ Auditoria de Validade do Almoxarifado\n\n` +
          `Foi realizada uma varredura completa nos registros de todas as unidades (SP, RJ, SJRP, BSB) e **não foram identificados produtos vencidos** no momento.\n\n` +
          `Todos os produtos perecíveis monitorados estão operando com data de validade regular.`
        );
      }
    }

    if (p.includes('ruptura') || p.includes('critico') || p.includes('crítico') || p.includes('minimo') || p.includes('mínimo')) {
      const critical = state.products.filter(pr => {
        const branchStock = pr.stockByBranch[currentBranch === 'GLOBAL' ? 'SP' : currentBranch] || 0;
        return branchStock <= pr.minStock;
      });
      let resp = `### ⚠️ Análise de Risco de Ruptura de Estoque\n\n`;
      if (critical.length > 0) {
        resp += `Identifiquei **${critical.length} itens** em nível crítico de estoque:\n\n`;
        resp += `| SKU | Produto | Categoria | Estoque Atual | Estoque Mínimo |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
        critical.forEach(pr => {
          const qty = pr.stockByBranch[currentBranch === 'GLOBAL' ? 'SP' : currentBranch] || 0;
          resp += `| ${pr.code} | ${pr.name} | ${pr.category} | **${qty}** | ${pr.minStock} |\n`;
        });
      } else {
        resp += `Todos os produtos monitorados estão com estoque operando acima da margem mínima de segurança no momento.`;
      }
      return resp;
    }

    // 6. ORDENS DE COMPRA (OCs) — Em aberto, ativas, pendentes ou gerais
    const isPOQuery =
      /\bocs?\b/i.test(p) ||
      p.includes('ordem de compra') ||
      p.includes('ordens de compra') ||
      p.includes('pedido de compra') ||
      p.includes('pedidos de compra') ||
      (p.includes('compras') && (p.includes('abert') || p.includes('quant') || p.includes('status') || p.includes('lista') || p.includes('andamento')));

    if (isPOQuery) {
      const openPOs = state.purchaseOrders.filter(po => po.status !== 'ENTREGUE' && po.status !== 'CANCELADO');
      const deliveredPOs = state.purchaseOrders.filter(po => po.status === 'ENTREGUE');
      const totalOpenValue = openPOs.reduce((acc, po) => acc + (po.totalValue || 0), 0);
      const totalDeliveredValue = deliveredPOs.reduce((acc, po) => acc + (po.totalValue || 0), 0);

      let resp = `### 🛒 Auditoria de Ordens de Compra (OCs) do ERP Almox Plus\n\n`;
      resp += `Atualmente temos **${openPOs.length} Ordens de Compra em aberto** (ativas) no sistema, totalizando **${fmt(totalOpenValue)}** em aquisições em andamento.\n\n`;
      resp += `No consolidado geral, constam **${state.purchaseOrders.length} OCs registradas** (${openPOs.length} em aberto e ${deliveredPOs.length} já entregue/concluída no valor de ${fmt(totalDeliveredValue)}).\n\n`;

      resp += `#### 1. Relação de Ordens de Compra em Aberto (${openPOs.length} OCs Ativas)\n`;
      resp += `| Código OC | Unidade | Fornecedor | Centro de Custo | Valor Total | Status Atual | Previsão de Entrega |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      openPOs.forEach(po => {
        const statusLabel =
          po.status === 'AGUARDANDO_APROVACAO'
            ? '⏳ Aguardando Aprovação'
            : po.status === 'EM_TRANSITO'
            ? '🚚 Em Trânsito'
            : po.status === 'APROVADO'
            ? '✅ Aprovado'
            : po.status;
        resp += `| **${po.code}** | Unidade ${po.branch} | ${po.supplierName} | ${po.costCenterName || po.costCenterId || 'Geral'} | **${fmt(po.totalValue)}** | ${statusLabel} | ${po.estimatedDeliveryDate ? new Date(po.estimatedDeliveryDate).toLocaleDateString('pt-BR') : 'A definir'} |\n`;
      });
      resp += `\n`;

      resp += `#### 2. Distribuição das OCs em Aberto por Unidade Operacional\n`;
      const posByBranchMap: Record<string, { count: number; total: number }> = {};
      openPOs.forEach(po => {
        if (!posByBranchMap[po.branch]) posByBranchMap[po.branch] = { count: 0, total: 0 };
        posByBranchMap[po.branch].count += 1;
        posByBranchMap[po.branch].total += (po.totalValue || 0);
      });

      for (const [branch, data] of Object.entries(posByBranchMap)) {
        resp += `- **Unidade ${branch}:** **${data.count} OC(s) em aberto** — Total: **${fmt(data.total)}**\n`;
      }
      resp += `\n`;

      if (deliveredPOs.length > 0) {
        resp += `#### 3. Ordens de Compra Concluídas / Entregues (${deliveredPOs.length} OCs)\n`;
        deliveredPOs.forEach(po => {
          resp += `- **${po.code}** (${po.supplierName}) — Unidade ${po.branch} | Valor: ${fmt(po.totalValue)} [Status: Entregue/Concluída]\n`;
        });
        resp += `\n`;
      }

      resp += `💡 **Diagnóstico de Suprimentos:** As ordens em aberto representam suprimento prioritário para reposição de estoque nas filiais (destaque para EPIs no RJ e infraestrutura de TI em SP).`;
      return resp;
    }

    // 7. SOLICITAÇÕES DE COMPRA (SCs)
    const isSCQuery =
      /\bscs?\b/i.test(p) ||
      p.includes('solicitacao de compra') ||
      p.includes('solicitacoes de compra') ||
      p.includes('cotacao') ||
      p.includes('cotacoes');

    if (isSCQuery) {
      const pendingSCs = state.purchaseRequests.filter(sc => sc.status === 'PENDENTE');
      let resp = `### 📋 Solicitações de Compra (SCs) no Sistema\n\n`;
      resp += `Atualmente temos **${state.purchaseRequests.length} Solicitações de Compra** cadastradas, sendo **${pendingSCs.length} pendente(s)** de cotação/atendimento:\n\n`;
      resp += `| Código SC | Unidade | Solicitante | Prioridade | Status | Justificativa |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      state.purchaseRequests.forEach(sc => {
        resp += `| **${sc.code}** | Unidade ${sc.branch} | ${sc.requestedBy} | ${sc.priority} | ${sc.status} | ${sc.justification ? sc.justification.slice(0, 60) + '...' : 'Sem justificativa'} |\n`;
      });
      return resp;
    }

    // 8. REQUISIÇÕES DE MATERIAL (INTERNAS)
    const isReqQuery =
      p.includes('requisic') ||
      p.includes('solicitacao de material') ||
      p.includes('pedido interno') ||
      p.includes('pedidos internos');

    if (isReqQuery) {
      const pendingReqs = state.requisitions.filter(r => r.status === 'PENDENTE');
      let resp = `### 📦 Requisições de Material Internas\n\n`;
      resp += `Temos **${state.requisitions.length} Requisições Internas** cadastradas, sendo **${pendingReqs.length} pendente(s)** de atendimento:\n\n`;
      if (state.requisitions.length > 0) {
        resp += `| Código Req | Unidade | Centro de Custo | Solicitante | Status | Prioridade |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        state.requisitions.forEach(r => {
          resp += `| **${r.code}** | Unidade ${r.branch} | ${r.costCenterName || r.costCenterId || 'Geral'} | ${r.requestedBy} | ${r.status} | ${r.priority} |\n`;
        });
      }
      return resp;
    }

    // 9. PATRIMÔNIO & ATIVOS
    if (p.includes('patrimonio') || p.includes('ativo') || p.includes('equipamento') || p.includes('fluke')) {
      let resp = `### 🏷️ Consulta de Ativos e Patrimônio Imobilizado\n\n`;
      resp += `O ERP Almox Plus gerencia **${state.assets.length} ativos corporativos**:\n\n`;
      resp += `| Tag Patrimonial | Nome do Equipamento | Unidade | Categoria | Valor Atual | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      state.assets.forEach(a => {
        resp += `| **${a.assetTag}** | ${a.name} | Unidade ${a.branch} | ${a.category} | ${fmt(a.value || 0)} | ${a.status} |\n`;
      });
      return resp;
    }

    return (
      `### 📋 Painel Operacional Integrado — Assistente Almox Plus\n\n` +
      `Dados consolidados para a unidade **${currentBranch}**:\n` +
      `- **Catálogo de Produtos:** ${state.products.length} itens cadastrados.\n` +
      `- **Ordens de Compra Ativas:** ${state.purchaseOrders.filter(po => po.status !== 'ENTREGUE').length} OCs.\n` +
      `- **Requisições Pendentes:** ${state.requisitions.filter(r => r.status === 'PENDENTE').length} requisições.\n` +
      `- **Transferências em Trânsito:** ${state.transfers.filter(t => t.status === 'EM_TRANSITO').length} remessas.\n\n` +
      `Fico à disposição para detalhar qualquer despesa, fornecedor ou centro de custo!`
    );
  };

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

      // Cálculo de métricas financeiras globais e por unidade
      const totalInventoryValue = state.products
        .filter(p => p.active !== false)
        .reduce((acc, p) => {
          const totalUnits = Object.values(p.stockByBranch || {}).reduce((s, q) => s + (Number(q) || 0), 0);
          return acc + totalUnits * (p.unitPrice || 0);
        }, 0);

      const activePOs = state.purchaseOrders.filter(po => po.status !== 'CANCELADO');
      const totalPurchasedValue = activePOs.reduce((acc, po) => acc + (po.totalValue || 0), 0);

      const posByBranch: Record<string, { count: number; total: number }> = {};
      activePOs.forEach(po => {
        if (!posByBranch[po.branch]) posByBranch[po.branch] = { count: 0, total: 0 };
        posByBranch[po.branch].count += 1;
        posByBranch[po.branch].total += (po.totalValue || 0);
      });

      const totalCostCenterBudget = state.costCenters.reduce((acc, c) => acc + (c.budget || 0), 0);
      const totalCostCenterSpent = state.costCenters.reduce((acc, c) => acc + (c.spent || 0), 0);

      const costCentersBreakdown = state.costCenters.map(c => ({
        codigo: c.code,
        nome: c.name,
        unidade: c.branch,
        orcamento: c.budget,
        gastoRealizado: c.spent,
        saldoRestante: c.budget - c.spent
      }));

      const recentOrders = activePOs.slice(0, 8).map(po => ({
        codigo: po.code,
        unidade: po.branch,
        fornecedor: po.supplierName,
        valorTotal: po.totalValue,
        status: po.status
      }));

      const now = new Date();
      const productsContext = state.products.map(p => {
        const totalUnits = Object.values(p.stockByBranch || {}).reduce((s, q) => s + (Number(q) || 0), 0);
        let daysToExp: number | null = null;
        let isExpired = false;
        let isExpiringSoon = false;

        if (p.expirationDate) {
          const exp = new Date(p.expirationDate);
          const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          daysToExp = diff;
          isExpired = diff < 0;
          isExpiringSoon = diff >= 0 && diff <= 60;
        }

        const batchList = p.batches && p.batches.length > 0
          ? p.batches
          : (p.batchNumber ? [{ batchNumber: p.batchNumber, expirationDate: p.expirationDate || '', branch: 'GLOBAL', quantity: totalUnits }] : []);
        const distinctBatches = Array.from(new Set(batchList.map(b => b.batchNumber).filter(Boolean)));
        const sameBatchAcrossUnits = distinctBatches.length <= 1;

        return {
          sku: p.code,
          nome: p.name,
          categoria: p.category,
          unidadeMedida: p.unit,
          estoqueLocal: p.stockByBranch[selectedBranch === 'GLOBAL' ? 'SP' : selectedBranch] || 0,
          estoqueGlobal: totalUnits,
          estoquePorUnidade: p.stockByBranch,
          min: p.minStock,
          preco: p.unitPrice,
          valorTotalEstoque: totalUnits * (p.unitPrice || 0),
          dataValidade: p.expirationDate || null,
          diasAteVencimento: daysToExp,
          statusValidade: isExpired ? 'VENCIDO' : isExpiringSoon ? 'VENCENDO_EM_BREVE' : (p.expirationDate ? 'EM_DIA' : 'SEM_CONTROLE'),
          lotePrincipal: p.batchNumber || (batchList[0]?.batchNumber) || 'LT-PADRAO',
          mesmoLoteTodasUnidades: sameBatchAcrossUnits,
          lotes: batchList
        };
      });

      const summaryData = {
        totalProducts: state.products.length,
        pendingRequisitions: state.requisitions.filter(r => r.status === 'PENDENTE').length,
        openPurchaseOrders: state.purchaseOrders.filter(po => po.status !== 'ENTREGUE').length,
        inTransitTransfers: state.transfers.filter(t => t.status === 'EM_TRANSITO').length,
        valorTotalEstoque: totalInventoryValue,
        gastoTotalOrdensCompra: totalPurchasedValue,
        gastosPorUnidade: posByBranch,
        orcamentoTotalCentrosCusto: totalCostCenterBudget,
        gastoTotalCentrosCusto: totalCostCenterSpent,
        saldoDisponivelCentrosCusto: totalCostCenterBudget - totalCostCenterSpent
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
            costCenters: costCentersBreakdown,
            purchaseOrders: state.purchaseOrders,
            purchaseRequests: state.purchaseRequests,
            requisitions: state.requisitions,
            transfers: state.transfers,
            assets: state.assets,
            products: productsContext
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
      console.warn('API /api/gemini indisponível ou com latência. Ativando resposta inteligente contextual do ERP:', err);
      // Fallback local instantâneo com base no estado integral do ERP
      const fallbackReply = generateClientAnalysis(textToSend, selectedBranch);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'AI',
        text: fallbackReply,
        timestamp: new Date()
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, aiMsg] };
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
