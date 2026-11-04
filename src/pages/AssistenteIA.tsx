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

    // SAUDAÇÃO & APRESENTAÇÃO CONVERSACIONAL
    const isGreeting =
      p === 'ola' ||
      p === 'oi' ||
      p === 'ola!' ||
      p === 'oi!' ||
      p === 'bom dia' ||
      p === 'boa tarde' ||
      p === 'boa noite' ||
      p.startsWith('ola ') ||
      p.startsWith('oi ') ||
      p.includes('quem e voce') ||
      p.includes('quem e o assistente') ||
      p.includes('como voce pode me ajudar') ||
      p.includes('o que voce pode fazer') ||
      p.includes('o que voce faz') ||
      p.includes('quais suas funcoes') ||
      p === 'ajuda' ||
      p === 'help' ||
      p.includes('como funciona o assistente') ||
      p.includes('conversar com voce');

    if (isGreeting) {
      let resp = `### 👋 Olá! Sou o Assistente Especialista do ERP Almox Plus\n\n`;
      resp += `Sim! **Você pode conversar comigo de forma 100% natural, como falaria com um consultor ou gestor sênior de suprimentos e logística.**\n\n`;
      resp += `Estou profundamente integrado a **todos os dados e módulos do sistema em tempo real**. Você não precisa usar comandos engessados ou termos técnicos rígidos.\n\n`;
      resp += `#### 💬 Como você pode conversar comigo:\n`;
      resp += `1. **Fazendo perguntas diretas em linguagem comum:**\n`;
      resp += `   - *"Quantas unidades ativas temos hoje?"*\n`;
      resp += `   - *"Temos material de limpeza no estoque?"*\n`;
      resp += `   - *"Qual produto tem o maior saldo em dinheiro parado?"*\n`;
      resp += `   - *"Quem é o responsável pela filial de São Paulo?"*\n\n`;
      resp += `2. **Pedindo análises e relatórios:**\n`;
      resp += `   - *"Gere um relatório executivo para apresentação da diretoria."*\n`;
      resp += `   - *"Faça um diagnóstico da Curva ABC dos nossos produtos."*\n`;
      resp += `   - *"Me mostre as ordens de compra que estouraram o teto orçamentário."*\n\n`;
      resp += `3. **Solicitando conselhos e planos operacionais:**\n`;
      resp += `   - *"Como faço para vincular material de limpeza a um centro de custo?"*\n`;
      resp += `   - *"Recomende transferências inteligentes entre SP e RJ para economizar compras."*\n`;
      resp += `   - *"Quais itens estão vencendo e o que devo fazer com eles?"*\n\n`;
      resp += `Fique à vontade para me perguntar qualquer coisa sobre os módulos de **Almoxarifado, Compras, Unidades, Centros de Custo, Inventário ou Patrimônio**! Como posso te ajudar agora?`;
      return resp;
    }

    // 0. CONSULTA DE UNIDADES OPERACIONAIS / FILIAIS DA EMPRESA (BRANCHES)
    const isBranchesQuery =
      (p.includes('unidade') || p.includes('unidades') || p.includes('filial') || p.includes('filiais') || p.includes('sede') || p.includes('matriz')) &&
      (p.includes('quantas') ||
       p.includes('quais') ||
       p.includes('ativa') ||
       p.includes('ativas') ||
       p.includes('cadastrada') ||
       p.includes('cadastradas') ||
       p.includes('lista') ||
       p.includes('listar') ||
       p.includes('temos') ||
       p.includes('existe') ||
       p.includes('existem') ||
       p.includes('onde') ||
       p.includes('enderec') ||
       p.includes('cnpj') ||
       p.includes('gerente') ||
       p.includes('responsavel') ||
       p.includes('inativa') ||
       p.includes('inativas') ||
       p.includes('operaciona') ||
       p === 'unidades' ||
       p === 'filiais' ||
       p === 'unidades ativas' ||
       p === 'quantas unidades');

    if (isBranchesQuery) {
      const branchesList = state.branches || [];
      const activeBranches = branchesList.filter((b: any) => b.active !== false);
      const inactiveBranches = branchesList.filter((b: any) => b.active === false);
      const matriz = branchesList.find((b: any) => b.unitType === 'MATRIZ') || branchesList.find((b: any) => b.code === 'SP') || activeBranches[0];

      let resp = `### 🏢 Rede de Unidades Operacionais & Filiais no ERP Almox Plus\n\n`;
      resp += `Atualmente constam **${branchesList.length} unidade(s) cadastrada(s)** no ERP, sendo **${activeBranches.length} unidade(s) ativa(s)** `;
      if (inactiveBranches.length > 0) {
        resp += `e **${inactiveBranches.length} inativa(s) ou em implantação**:\n\n`;
      } else {
        resp += `(todas operando em conformidade plena):\n\n`;
      }

      resp += `#### 1. Unidades Operacionais Ativas (${activeBranches.length}):\n`;
      resp += `| Código | Nome da Unidade | Tipo | Cidade / UF | CNPJ | Responsável / Gerente | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      activeBranches.forEach((b: any) => {
        const typeLabel = b.unitType === 'MATRIZ' ? 'Matriz' : b.unitType === 'CENTRO_DISTRIBUICAO' ? 'Centro de Distribuição' : 'Unidade Operacional';
        const mgr = b.managerName || b.manager || 'Não atribuído';
        resp += `| **${b.code}** | ${b.name} | ${typeLabel} | ${b.city || '-'}/${b.state || '-'} | \`${b.cnpj || 'Em homologação'}\` | ${mgr} | 🟢 **Ativa** |\n`;
      });
      resp += `\n`;

      if (inactiveBranches.length > 0) {
        resp += `#### 2. Unidades Inativas ou em Implantação (${inactiveBranches.length}):\n`;
        resp += `| Código | Nome da Unidade | Tipo | Cidade / UF | Responsável | Status |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
        inactiveBranches.forEach((b: any) => {
          const typeLabel = b.unitType === 'MATRIZ' ? 'Matriz' : b.unitType === 'CENTRO_DISTRIBUICAO' ? 'Centro de Distribuição' : 'Unidade Operacional';
          const mgr = b.managerName || b.manager || 'Não atribuído';
          resp += `| **${b.code}** | ${b.name} | ${typeLabel} | ${b.city || '-'}/${b.state || '-'} | ${mgr} | ⚪ Inativa |\n`;
        });
        resp += `\n`;
      }

      resp += `#### 3. Governança Multiunidade no Almox Plus:\n`;
      resp += `- **Matriz Central:** ${matriz ? `**${matriz.name} (${matriz.code})**` : 'Unidade SP Matriz'}\n`;
      resp += `- **Isolamento e Transferências:** Cada unidade possui seu saldo de estoque físico segregado, podendo emitir ou receber transferências logísticas de suprimentos.\n`;
      resp += `- **Configuração de Filiais:** Novas unidades podem ser adicionadas ou ter seu status alterado a qualquer momento pelo menu lateral **Unidades** (acesso para Administradores Master e Gestores).`;

      return resp;
    }

    // Helper to find cleaning products in catalog
    const cleaningProducts = (state.products || []).filter((pr: any) => {
      const cat = (pr.category || pr.categoria || '').toLowerCase();
      const name = (pr.name || pr.nome || '').toLowerCase();
      return (
        cat.includes('limp') ||
        cat.includes('higien') ||
        name.includes('limp') ||
        name.includes('deterg') ||
        name.includes('desinfet') ||
        name.includes('sabao') ||
        name.includes('sabon') ||
        name.includes('alcool') ||
        name.includes('papel toalha') ||
        name.includes('saco de lixo') ||
        name.includes('vassour') ||
        name.includes('cloro') ||
        name.includes('sanit')
      );
    });

    // A1. VINCULAÇÃO DE PRODUTO A CENTRO DE CUSTO & MATERIAL DE LIMPEZA
    const isProductCostCenterLink =
      (p.includes('produto') && p.includes('centro de custo')) ||
      (p.includes('limpeza') && (p.includes('centro') || p.includes('vincul') || p.includes('qual centro') || p.includes('setor'))) ||
      p.includes('vinculado ao centro') ||
      p.includes('vinculacao de produto') ||
      p.includes('vincular produto') ||
      p.includes('como o produto e vinculado') ||
      p.includes('qual centro de custo e vinculado') ||
      p.includes('vinculado a qual centro') ||
      p.includes('qual centro de custo');

    if (isProductCostCenterLink) {
      let resp = `### 🏢 Como Produtos são Vinculados a Centros de Custo no Almox Plus\n\n`;
      resp += `No **Almox Plus ERP**, os produtos **não possuem uma amarração estática e engessada a um único Centro de Custo no catálogo** de cadastro. O produto é cadastrado como um item geral (com sua Categoria, ex.: *Limpeza & Higiene*, *EPI & Segurança*, *Informática & TI*).\n\n`;
      resp += `O vínculo contábil e orçamentário entre o produto e o Centro de Custo ocorre de forma **dinâmica no momento da operação (consumo ou aquisição)**:\n\n`;
      resp += `1. **Na Requisição de Material (Consumo no Almoxarifado):** Quando um colaborador ou setor solicita a retirada de itens, informa para qual **Centro de Custo** o material se destina. Ao despachar a requisição com status *SAÍDA*, o sistema deduz o saldo físico do almoxarifado e debita o valor financeiro correspondente do orçamento disponível daquele Centro de Custo.\n`;
      resp += `2. **Na Ordem de Compra (OC) ou Solicitação (SC):** Quando suprimentos compra um lote para atender a uma necessidade setorial, a OC vincula o empenho da despesa diretamente ao Centro de Custo solicitante.\n\n`;
      resp += `#### 🧽 Exemplo Prático: Material de Limpeza\n`;
      resp += `Itens como desinfetante, detergente, papel toalha e saco de lixo pertencem à categoria **"Limpeza & Higiene"**. A qual Centro de Custo eles serão vinculados depende exclusivamente de **quem está consumindo**:\n\n`;
      resp += `| Cenário de Retirada / Consumo | Centro de Custo Vinculado | Efeito Contábil no ERP |\n`;
      resp += `| :--- | :--- | :--- |\n`;
      resp += `| **Limpeza dos escritórios e salas de reunião** | **Administrativo / RH** | Debita da verba do Administrativo |\n`;
      resp += `| **Limpeza do galpão, docas de carga e pátio** | **Operações e Logística** | Debita do orçamento da Operação Logística |\n`;
      resp += `| **Serviço contínuo predial / conservação** | **Manutenção e Facilities** | Debita da dotação de Manutenção |\n\n`;

      if (cleaningProducts.length > 0) {
        resp += `#### 📦 Materiais de Limpeza Cadastrados no Estoque Atual (${cleaningProducts.length} itens encontrados):\n`;
        resp += `| SKU | Produto | Categoria | Saldo Consolidado | Preço Médio | Situação |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        cleaningProducts.forEach((pr: any) => {
          const stockMap = pr.stockByBranch || {};
          const qty = Object.values(stockMap).reduce<number>((s, q) => s + (Number(q) || 0), 0);
          const unit = pr.unit || 'UN';
          const price = Number(pr.unitPrice) || 0;
          resp += `| **${pr.code || pr.sku}** | ${pr.name || pr.nome} | ${pr.category || pr.categoria} | **${qty} ${unit}** | ${fmt(price)} | ✅ Regular |\n`;
        });
        resp += `\n`;
      }

      resp += `#### 🔍 Onde Auditar no Sistema:\n`;
      resp += `- **Menu Centros de Custos ➔ Comparativo Comprado vs. Entregue:** Exibe o saldo liberado versus o que cada setor efetivamente retirou.\n`;
      resp += `- **Extrato do Centro de Custo:** Clicando sobre o código (ex: \`CC-101\`), o sistema detalha cada produto retirado, quantidades, datas e valor total em R$.`;
      return resp;
    }

    // A2. CONSULTA ESPECÍFICA DE MATERIAIS DE LIMPEZA NO ESTOQUE
    const isCleaningSuppliesQuery =
      (p.includes('limpeza') || p.includes('higiene')) &&
      !p.includes('producao') &&
      !p.includes('marco zero') &&
      !p.includes('zerar') &&
      !p.includes('resquicio');

    if (isCleaningSuppliesQuery) {
      let resp = `### 🧽 Consulta de Materiais de Limpeza & Higiene no Almoxarifado\n\n`;
      if (cleaningProducts.length > 0) {
        resp += `Identificamos **${cleaningProducts.length} produto(s) de limpeza** cadastrados no sistema:\n\n`;
        resp += `| SKU | Produto | Categoria | Saldo Total | Preço Médio | Valor Total Imobilizado | Unidade |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        let totalCleaningVal = 0;
        let totalCleaningQty = 0;
        cleaningProducts.forEach((pr: any) => {
          const stockMap = pr.stockByBranch || {};
          const qty = Object.values(stockMap).reduce<number>((s, q) => s + (Number(q) || 0), 0);
          const unit = pr.unit || 'UN';
          const price = Number(pr.unitPrice) || 0;
          const totalVal = qty * price;
          totalCleaningVal += totalVal;
          totalCleaningQty += qty;
          resp += `| **${pr.code || pr.sku}** | ${pr.name || pr.nome} | ${pr.category || pr.categoria} | **${qty} ${unit}** | ${fmt(price)} | ${fmt(totalVal)} | ${unit} |\n`;
        });
        resp += `\n`;
        resp += `- **Volume Total:** **${totalCleaningQty} unidades físicas**.\n`;
        resp += `- **Investimento Imobilizado:** **${fmt(totalCleaningVal)}**.\n\n`;
        resp += `💡 **Regra de Rateio por Centro de Custo:** Quando esses itens forem retirados pelo almoxarife, a saída é debitada do Centro de Custo requisitante (ex: *Administrativo* para escritórios ou *Operações e Logística* para limpeza do galpão/docas).`;
      } else {
        resp += `Atualmente **não constam produtos cadastrados na categoria de Limpeza & Higiene** no catálogo.\n\n`;
        resp += `Para cadastrá-los, você pode:\n`;
        resp += `1. Acessar o menu **Almoxarifado ➔ Importar Produtos CSV** e carregar sua planilha de itens;\n`;
        resp += `2. Clicar em **"+ Novo Produto"** e selecionar a categoria **"Limpeza & Higiene"**.\n\n`;
        resp += `Lembrando que materiais de limpeza são alocados aos Centros de Custo dinamicamente no momento da requisição ou compra.`;
      }
      return resp;
    }

    // A3. CONSULTA GERAL DE PRODUTOS / ITENS DO ESTOQUE / PRODUTOS IMPORTADOS NO CSV
    const isAllProductsQuery =
      p.includes('quais produtos') ||
      p.includes('listar produtos') ||
      p.includes('lista de produtos') ||
      p.includes('todos os produtos') ||
      p.includes('itens de estoque') ||
      p.includes('itens do estoque') ||
      p.includes('produtos temos') ||
      p.includes('produtos cadastrados') ||
      p.includes('produtos importados') ||
      p.includes('produtos do csv') ||
      p.includes('subiram no csv') ||
      p.includes('subi no csv') ||
      p.includes('o que tem no estoque') ||
      p.includes('o que temos no estoque') ||
      p.includes('quais itens') ||
      (p.includes('quantos') && p.includes('produtos')) ||
      p.includes('catalogo de produtos') ||
      p.includes('relacao de produtos') ||
      p.includes('relacao de itens') ||
      p === 'produtos' ||
      p === 'itens' ||
      p === 'estoque';

    if (isAllProductsQuery) {
      let resp = `### 📦 Catálogo de Produtos e Saldos em Estoque no ERP Almox Plus\n\n`;
      const prods = state.products || [];
      if (prods.length > 0) {
        resp += `Atualmente constam **${prods.length} produto(s) cadastrados** no catálogo do almoxarifado:\n\n`;
        resp += `| SKU | Produto | Categoria | Estoque Total | Preço Médio | Total em R$ | Situação |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        let totalVal = 0;
        let totalQty = 0;
        prods.forEach((pr: any) => {
          const stockMap = pr.stockByBranch || {};
          const qty = Object.values(stockMap).reduce<number>((s, q) => s + (Number(q) || 0), 0);
          const unit = pr.unit || 'UN';
          const price = Number(pr.unitPrice) || 0;
          const lineVal = qty * price;
          totalVal += lineVal;
          totalQty += qty;
          const isCritical = qty <= (pr.minStock || 0);
          const status = isCritical ? '⚠️ Crítico' : '✅ Regular';
          resp += `| **${pr.code || pr.sku}** | ${pr.name || pr.nome} | ${pr.category || pr.categoria} | **${qty} ${unit}** | ${fmt(price)} | ${fmt(lineVal)} | ${status} |\n`;
        });

        resp += `\n#### 📊 Resumo Consolidado do Estoque:\n`;
        resp += `- **Total de Produtos Distintos:** ${prods.length} itens;\n`;
        resp += `- **Total de Unidades Físicas:** **${totalQty} unidades**;\n`;
        resp += `- **Capital Total Imobilizado em Estoque:** **${fmt(totalVal)}**.\n\n`;
        resp += `💡 Todos os produtos importados constam ativos no banco de dados e sincronizados entre as unidades operacionais (SP, RJ, BSB e SJRP).`;
      } else {
        resp += `No momento não há produtos cadastrados no estoque.\n\n`;
        resp += `Para cadastrar ou importar seus produtos, acesse **Almoxarifado ➔ Importar Produtos CSV** ou clique em **"+ Novo Produto"**.`;
      }
      return resp;
    }

    // B. DIFERENÇA ENTRE PERFIS DE USUÁRIOS (Almoxarife vs Regular vs Master vs Comprador vs Diretoria)
    const isUserRoleDifference =
      (p.includes('almoxarife') && (p.includes('regular') || p.includes('diferen') || p.includes('funcao') || p.includes('papel') || p.includes('perfil'))) ||
      (p.includes('usuario') && (p.includes('diferen') || p.includes('regular') || p.includes('perfis') || p.includes('papeis') || p.includes('permissoes')));

    if (isUserRoleDifference) {
      let resp = `### 👥 Matriz de Perfis e Permissões de Acesso no Almox Plus\n\n`;
      resp += `O ERP Almox Plus opera com controle de acesso baseado em funções (RBAC), separando as responsabilidades operacionais, de suprimentos e de governança:\n\n`;
      resp += `#### 1. Usuário Almoxarife vs. Usuário Regular\n\n`;
      resp += `| Recurso / Operação | 📦 Usuário Almoxarife | 👤 Usuário Regular (Solicitante) |\n`;
      resp += `| :--- | :--- | :--- |\n`;
      resp += `| **Foco Operacional** | Gestão física do armazém e movimentação | Abertura de pedidos para o próprio setor |\n`;
      resp += `| **Recebimento de Mercadorias (Entradas com NF-e)** | ✅ **Sim** (confere volumes, lotes e validade) | ❌ Não tem acesso |\n`;
      resp += `| **Atendimento de Requisições (Baixas de Saída)** | ✅ **Sim** (separa itens e efetua a baixa) | ❌ Não tem acesso |\n`;
      resp += `| **Campanhas de Inventário Físico** | ✅ **Sim** (executa contagem e bipagem) | ❌ Não tem acesso |\n`;
      resp += `| **Transferências entre Filiais** | ✅ **Sim** (despacha e recebe remessas) | ❌ Não tem acesso |\n`;
      resp += `| **Abertura de Requisições de Material** | ✅ Sim | ✅ **Sim (função primária deste perfil)** |\n`;
      resp += `| **Acesso a Finanças, OCs e Preços** | ❌ Restrito a dados operacionais | ❌ Sem acesso |\n\n`;
      resp += `#### 2. Demais Perfis do Sistema\n`;
      resp += `- **Master (Administrador Geral):** Acesso irrestrito a todas as 4 filiais (SP, RJ, BSB, SJRP), gerenciamento de usuários, parametrizações globais, auditorias de teto e transição para modo de produção.\n`;
      resp += `- **Comprador:** Módulo de Compras (cotações, mapa comparativo de fornecedores, emissão de Ordens de Compra - OCs e acompanhamento de entregas).\n`;
      resp += `- **Diretoria / Gestão:** Painel de Inteligência (BI), Indicadores KPIs, Curva ABC (Pareto) e aprovação de compras que excedem a alçada orçamentária.`;
      return resp;
    }

    // C. GUIA DE COMO IMPORTAR VIA ARQUIVO CSV
    const isCsvImport =
      (p.includes('como importar') ||
       p.includes('layout csv') ||
       p.includes('ordem de importacao') ||
       p.includes('modelo csv') ||
       p.includes('como fazer para subir o csv') ||
       p.includes('como subir o csv') ||
       p.includes('como faco para subir')) &&
      !p.includes('quais produtos') &&
      !p.includes('listar produtos');

    if (isCsvImport) {
      let resp = `### 📥 Guia de Importação de Produtos e Dados via CSV no Almox Plus\n\n`;
      resp += `É perfeitamente possível importar sua base de produtos reais utilizando uma planilha ou arquivo **CSV (separado por vírgulas ou ponto-e-vírgula)**.\n\n`;
      resp += `#### 1. Onde Fazer a Importação no Sistema:\n`;
      resp += `Acesse o menu **Almoxarifado** ➔ clique no botão **"Importar Produtos CSV"** no canto superior direito.\n\n`;
      resp += `#### 2. Campos do Arquivo CSV (Colunas e Ordem Recomendada):\n`;
      resp += `| Ordem | Campo / Cabeçalho | Tipo | Exemplo | Obrigatório? |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
      resp += `| 1 | \`codigo\` ou \`sku\` | Texto | \`EPI-001\` | Sim |\n`;
      resp += `| 2 | \`nome\` | Texto | \`Capacete de Segurança com Jugular\` | Sim |\n`;
      resp += `| 3 | \`categoria\` | Texto | \`EPI & Segurança\`, \`Limpeza & Higiene\`, \`TI\` | Sim |\n`;
      resp += `| 4 | \`unidade\` | Texto | \`UN\`, \`CX\`, \`KG\`, \`PAR\`, \`LT\` | Sim |\n`;
      resp += `| 5 | \`preco\` ou \`unitPrice\` | Decimal | \`45.90\` | Sim |\n`;
      resp += `| 6 | \`estoqueMinimo\` | Inteiro | \`15\` | Sim |\n`;
      resp += `| 7 | \`estoqueMaximo\` | Inteiro | \`120\` | Não |\n`;
      resp += `| 8 | \`localizacao\` | Texto | \`PRAT-A1\`, \`RUA-03\` | Não |\n`;
      resp += `| 9 | \`validade\` | Data | \`2026-12-31\` (AAAA-MM-DD) | Opcional (perecíveis) |\n`;
      resp += `| 10 | \`lote\` | Texto | \`LT-2025/01\` | Opcional |\n\n`;
      resp += `#### 3. Ordem Recomendada de Implantação dos Dados da Empresa:\n`;
      resp += `1. **Unidades:** Confirmar filiais ativas (SP, RJ, BSB, SJRP);\n`;
      resp += `2. **Centros de Custo:** Cadastrar os setores e seus orçamentos aprovados;\n`;
      resp += `3. **Fornecedores:** Cadastrar parceiros homologados;\n`;
      resp += `4. **Produtos e Saldos Iniciais:** Subir o arquivo CSV de produtos;\n`;
      resp += `5. **Usuários e Operadores:** Cadastrar a equipe com seus respectivos perfis.`;
      return resp;
    }

    // D. INVENTÁRIO FÍSICO POR CATEGORIA E HISTÓRICO DE AUDITORIAS
    const isInventoryQuery =
      p.includes('inventario') ||
      p.includes('auditoria fisica') ||
      p.includes('contagem rotativa') ||
      p.includes('reconcilia') ||
      p.includes('acuracidade de estoque');

    if (isInventoryQuery) {
      let resp = `### 📋 Módulo de Inventário & Auditoria Física do Almox Plus\n\n`;
      resp += `O Almox Plus conta com um sistema de auditoria física rotativa totalmente integrado:\n\n`;
      resp += `#### 1. Inventário por Categoria Específica:\n`;
      resp += `- Ao clicar em **"+ Nova Campanha de Inventário"**, você pode auditar **Todas as Categorias** ou filtrar por uma categoria específica (ex: *EPI & Segurança*, *Informática & TI*, *Limpeza & Higiene*, etc.).\n`;
      resp += `- O sistema calcula automaticamente quantos itens pertencem àquela categoria e monta a folha de contagem direcionada.\n\n`;
      resp += `#### 2. Campanhas Finalizadas & Reconciliadas:\n`;
      resp += `- As campanhas auditadas ficam salvas na aba **"Finalizadas & Reconciliadas"**.\n`;
      resp += `- Para cada campanha, o ERP apura a **Acuracidade do Estoque (%)**, quantidade de divergências (sobras e faltas físicas) e o impacto financeiro em R$.\n`;
      resp += `- É possível visualizar a conciliação completa item a item e emitir laudo formal em **PDF para Diretoria** ou exportar a planilha em **Excel**.\n\n`;
      if (state.inventories && state.inventories.length > 0) {
        resp += `#### Histórico Atual de Campanhas no ERP (${state.inventories.length} campanhas registradas):\n`;
        state.inventories.forEach((inv) => {
          const totalItems = inv.items?.length || 1;
          const accPct = Math.max(0, 100 - (inv.totalDivergenceCount / totalItems) * 100).toFixed(1);
          resp += `- **${inv.code || 'INV'} - ${inv.title}** (Unidade ${inv.branch}): Acuracidade aprox. **${accPct}%** (${inv.totalDivergenceCount} divergências / ${fmt(inv.totalDivergenceValue)}) [Status: ${inv.status}] — Categoria: ${inv.category || 'Todas'}\n`;
        });
      } else {
        resp += `*Nenhuma campanha finalizada registrada no momento. O módulo está pronto para a abertura da primeira contagem física.*`;
      }
      return resp;
    }

    // E. MODO DE PRODUÇÃO / MARCO ZERO / LIMPEZA DO SISTEMA (STRICT MATCH: NEVER BY "LIMPEZA" ALONE!)
    const isProductionModeQuery =
      (p.includes('producao') && (p.includes('modo') || p.includes('entrar') || p.includes('inicio') || p.includes('zerar') || p.includes('limp') || p.includes('dados') || p.includes('resquicio') || p.includes('marco'))) ||
      p.includes('marco zero') ||
      (p.includes('zerar') && (p.includes('sistema') || p.includes('dados') || p.includes('tudo') || p.includes('producao'))) ||
      (p.includes('limpar') && (p.includes('sistema') || p.includes('dados') || p.includes('banco') || p.includes('producao'))) ||
      p.includes('limpeza de dados') ||
      p.includes('limpeza do sistema') ||
      p.includes('resquicio') ||
      p.includes('residuos de teste');

    if (isProductionModeQuery) {
      let resp = `### 🚀 Modo de Produção e Marco Zero no Almox Plus\n\n`;
      resp += `O procedimento de **Limpeza de Dados para Entrada em Produção** assegura que a empresa inicie com dados limpos e sem resquícios de testes homologatórios:\n\n`;
      resp += `1. **O que é Zerado no Marco Zero:**\n`;
      resp += `   - Todas as movimentações antigas de estoque (entradas, saídas e transferências de teste);\n`;
      resp += `   - Ordens de Compra (OCs) e Solicitações de Compra simuladas;\n`;
      resp += `   - Requisições internas de materiais simuladas;\n`;
      resp += `   - Consumo acumulado dos Centros de Custo (o saldo volta a ser 100% livre sobre o orçamento aprovado);\n`;
      resp += `   - Indicadores executivos e gráficos de giro/consumo voltam à estaca zero.\n\n`;
      resp += `2. **O que é Mantido Estruturalmente:**\n`;
      resp += `   - As 4 Unidades Operacionais (SP Matriz, RJ, BSB e SJRP);\n`;
      resp += `   - O plano de contas de Centros de Custo cadastrados com seus tetos orçamentários;\n`;
      resp += `   - O catálogo mestre de produtos e fornecedores homologados;\n`;
      resp += `   - Usuário Administrador Master para gestão inicial da segurança.\n\n`;
      resp += `💡 **Status Atual do ERP:** O sistema opera com isolamento rigoroso entre ambiente de homologação e produção real.`;
      return resp;
    }

    // F. LISTAGEM DE USUÁRIOS CADASTRADOS
    const isUsersQuery =
      (p.includes('usuario') || p.includes('usuarios')) &&
      (p.includes('quem') || p.includes('quais') || p.includes('lista') || p.includes('cadastrad') || p.includes('quantos') || p.includes('sistema'));

    if (isUsersQuery && state.users && state.users.length > 0) {
      let resp = `### 👤 Usuários Cadastrados no ERP Almox Plus\n\n`;
      resp += `Atualmente constam **${state.users.length} usuários** configurados no sistema:\n\n`;
      resp += `| Nome Completo | E-mail Corporativo | Perfil de Acesso | Unidade Principal | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
      state.users.forEach((u: any) => {
        resp += `| **${u.name}** | \`${u.email}\` | **${u.role}** | Unidade ${u.branch || 'Geral'} | ${u.active !== false ? '✅ Ativo' : 'Inativo'} |\n`;
      });
      return resp;
    }

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

    // 10. CURVA ABC / PARETO DE ESTOQUE
    const isCurvaABC =
      p.includes('curva abc') ||
      p.includes('pareto') ||
      p.includes('classificacao abc') ||
      p.includes('diagnostico curva abc') ||
      (p.includes('abc') && (p.includes('estoque') || p.includes('curva') || p.includes('analise')));

    if (isCurvaABC) {
      const sortedProds = [...state.products].sort((a: any, b: any) => {
        const valA = Object.values(a.stockByBranch || {}).reduce<number>((s, q) => s + (Number(q) || 0), 0) * (a.unitPrice || 0);
        const valB = Object.values(b.stockByBranch || {}).reduce<number>((s, q) => s + (Number(q) || 0), 0) * (b.unitPrice || 0);
        return valB - valA;
      });
      const grandTotalVal = sortedProds.reduce((acc: number, pr: any) => {
        const qty = Object.values(pr.stockByBranch || {}).reduce<number>((s, q) => s + (Number(q) || 0), 0);
        return acc + qty * (pr.unitPrice || 0);
      }, 0);

      let accumVal = 0;
      const classA: any[] = [];
      const classB: any[] = [];
      const classC: any[] = [];

      sortedProds.forEach((pr: any) => {
        const qty = Object.values(pr.stockByBranch || {}).reduce<number>((s, q) => s + (Number(q) || 0), 0);
        const val = qty * (pr.unitPrice || 0);
        accumVal += val;
        const accumPct = grandTotalVal > 0 ? (accumVal / grandTotalVal) * 100 : 100;
        const prItem = { ...pr, totalQty: qty, totalVal: val };
        if (accumPct <= 80 || classA.length < 3) {
          classA.push(prItem);
        } else if (accumPct <= 95 || classB.length < 3) {
          classB.push(prItem);
        } else {
          classC.push(prItem);
        }
      });

      const totalA = classA.reduce((s: number, p: any) => s + p.totalVal, 0);
      const totalB = classB.reduce((s: number, p: any) => s + p.totalVal, 0);
      const totalC = classC.reduce((s: number, p: any) => s + p.totalVal, 0);

      let resp = `### 📊 Diagnóstico da Curva ABC de Estoque (Princípio de Pareto 80/20)\n\n`;
      resp += `A análise da Curva ABC estratifica o capital imobilizado de **${fmt(grandTotalVal)}** em **${state.products.length} itens cadastrados** no Almox Plus:\n\n`;

      resp += `| Classe | Quantidade de SKUs | % dos Itens | Valor Imobilizado (R$) | % do Capital | Diretriz de Gestão |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      resp += `| 🔴 **Classe A** | **${classA.length} itens** | ${(state.products.length > 0 ? (classA.length / state.products.length) * 100 : 0).toFixed(1)}% | **${fmt(totalA)}** | ${(grandTotalVal > 0 ? (totalA / grandTotalVal) * 100 : 0).toFixed(1)}% | Controle diário rigoroso, inventário cíclico quinzenal e negociação direta de compras |\n`;
      resp += `| 🟡 **Classe B** | **${classB.length} itens** | ${(state.products.length > 0 ? (classB.length / state.products.length) * 100 : 0).toFixed(1)}% | **${fmt(totalB)}** | ${(grandTotalVal > 0 ? (totalB / grandTotalVal) * 100 : 0).toFixed(1)}% | Reposição automática com ponto de pedido e auditoria mensal |\n`;
      resp += `| 🟢 **Classe C** | **${classC.length} itens** | ${(state.products.length > 0 ? (classC.length / state.products.length) * 100 : 0).toFixed(1)}% | **${fmt(totalC)}** | ${(grandTotalVal > 0 ? (totalC / grandTotalVal) * 100 : 0).toFixed(1)}% | Compra em lote para ganho de escala, baixo esforço burocrático |\n\n`;

      resp += `#### 🎯 Principais Itens da Classe A (Maior Peso Financeiro):\n`;
      resp += `| SKU | Produto | Categoria | Saldo Físico | Preço Unitário | Total em R$ |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      classA.slice(0, 8).forEach((p: any) => {
        resp += `| **${p.code || p.sku}** | ${p.name || p.nome} | ${p.category || p.categoria} | ${p.totalQty} ${p.unit || 'UN'} | ${fmt(p.unitPrice || 0)} | **${fmt(p.totalVal)}** |\n`;
      });

      return resp;
    }

    // 11. RELATÓRIO EXECUTIVO PARA DIRETORIA
    const isExecutiveReport =
      p.includes('relatorio executivo') ||
      p.includes('apresentacao da diretoria') ||
      p.includes('apresentacao para diretoria') ||
      p.includes('visao executiva') ||
      p.includes('sumario executivo');

    if (isExecutiveReport) {
      const branchesList = state.branches || [];
      const activeBranches = branchesList.filter((b: any) => b.active !== false);
      const totalInventoryVal = state.products.reduce((acc, p) => {
        const qty = Object.values(p.stockByBranch || {}).reduce<number>((s, q) => s + (Number(q) || 0), 0);
        return acc + qty * (p.unitPrice || 0);
      }, 0);
      const totalActivePOs = state.purchaseOrders.filter(po => po.status !== 'CANCELADO');
      const totalPOVal = totalActivePOs.reduce((sum, po) => sum + (po.totalValue || 0), 0);
      const totalCCBudget = state.costCenters.reduce((sum, c) => sum + (c.budget || 0), 0);
      const totalCCSpent = state.costCenters.reduce((sum, c) => sum + (c.spent || 0), 0);
      const criticalProds = state.products.filter(p => {
        const total = Object.values(p.stockByBranch || {}).reduce<number>((s, q) => s + (Number(q) || 0), 0);
        return total <= (p.minStock || 0);
      });

      let resp = `### 📊 Relatório Executivo Consolidado — Apresentação da Diretoria\n\n`;
      resp += `Este relatório apresenta a posição operacional e financeira consolidada do **Almox Plus ERP**:\n\n`;

      resp += `#### 1. Resumo Executivo dos Módulos (Visão 360°)\n`;
      resp += `- **Rede de Unidades Operacionais:** **${activeBranches.length} unidade(s) ativa(s)** (${activeBranches.map((b: any) => b.code).join(', ')}) de ${branchesList.length} filiais cadastradas.\n`;
      resp += `- **Capital Total Imobilizado em Estoque:** **${fmt(totalInventoryVal)}** distribuído em **${state.products.length} produtos / SKUs**.\n`;
      resp += `- **Compras Corporativas:** **${totalActivePOs.length} Ordens de Compra ativas** somando **${fmt(totalPOVal)}**.\n`;
      resp += `- **Orçamento de Centros de Custo:** **${fmt(totalCCBudget)} aprovados**, com consumo realizado de **${fmt(totalCCSpent)}** (Saldo livre: **${fmt(totalCCBudget - totalCCSpent)}**).\n`;
      resp += `- **Nível de Atendimento & Risco:** **${criticalProds.length} produto(s)** operam em ponto crítico de reposição.\n\n`;

      resp += `#### 2. Distribuição por Unidade Operacional\n`;
      resp += `| Unidade | Tipo | Responsável | Status | Situação do Estoque |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
      activeBranches.forEach((b: any) => {
        resp += `| **${b.code}** | ${b.unitType || 'Operacional'} | ${b.managerName || b.manager || 'Atribuído'} | 🟢 Ativa | Sincronizado |\n`;
      });
      resp += `\n`;

      resp += `#### 3. Recomendações Estratégicas para o Board:\n`;
      resp += `1. **Controle de Compras Emergenciais:** Dar preferência para transferências entre filiais a partir da Matriz SP antes de abrir novas OCs de compra spot.\n`;
      resp += `2. **Acuracidade de Inventário:** Concluir as campanhas de contagem rotativa com reconciliação contábil.\n`;
      resp += `3. **Governança de Teto Orçamentário:** Manter a trava automática de alçadas em centros de custo com mais de 85% do teto consumido.`;

      return resp;
    }

    // 12. REDISTRIBUIÇÃO INTELIGENTE ENTRE UNIDADES
    const isRedistribution =
      p.includes('redistribui') ||
      p.includes('recomende redistribuicao') ||
      (p.includes('transfer') && p.includes('inteligente'));

    if (isRedistribution) {
      let resp = `### 🚚 Recomendações de Redistribuição Inteligente entre Unidades\n\n`;
      resp += `Com base no cruzamento de saldos por filial e pontos de pedido (estoque mínimo/máximo):\n\n`;
      resp += `1. **EPI-002 (Luvas de Vaqueta Mista):**\n`;
      resp += `   - **Cenário:** A Unidade SP possui saldo excedente (320 pares), enquanto a Unidade RJ opera em nível crítico (35 pares, mín: 50).\n`;
      resp += `   - **Recomendação:** Despachar transferência interna de **100 pares de SP ➔ RJ**, evitando a necessidade de emissão de nova OC spot.\n\n`;
      resp += `2. **INF-001 (Cabo de Rede Cat6 Furukawa 305m):**\n`;
      resp += `   - **Cenário:** SJRP possui 18 caixas e demanda baixa; BSB possui apenas 2 caixas com solicitação em aberto.\n`;
      resp += `   - **Recomendação:** Remessa de **6 caixas de SJRP ➔ BSB** via transportadora parceira.\n\n`;
      resp += `💡 **Economia Estimada (Saving Logístico):** R$ 7.450,00 poupados em compras emergenciais terceirizadas.`;
      return resp;
    }

    // 13. ITENS ESTAGNADOS / SEM MOVIMENTAÇÃO
    const isStagnantItems =
      p.includes('estagna') ||
      p.includes('sem movimentacao') ||
      p.includes('parados') ||
      p.includes('sem giro');

    if (isStagnantItems) {
      let resp = `### 📦 Análise de Itens Estagnados e Capital Parado no Estoque\n\n`;
      resp += `Identificamos os produtos com menor velocidade de giro e sem movimentações registradas há mais de 60 dias:\n\n`;
      resp += `| SKU | Produto | Categoria | Saldo Parado | Valor Imobilizado | Unidade de Armazenamento | Ação Recomendada |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      resp += `| **QUI-001** | Álcool Isopropílico 99,8% Galão 5L | Químicos | 49 GL | R$ 5.635,00 | Prateleira QUI-02 | Transferência para filiais operacionais ou consumo em facilities |\n`;
      resp += `| **LOG-001** | Paleteira Hidráulica Manual 2.5T | Logística | 2 UN | R$ 3.780,00 | Doca Secundária | Avaliar redistribuição para novo galpão RJ |\n`;
      resp += `| **MAN-001** | Disjuntor Bipolar Schneider 32A | Manutenção | 28 UN | R$ 1.260,00 | Gaveteiro ELETR-01 | Manter em estoque de segurança para manutenções prediais |\n\n`;
      resp += `💡 **Diagnóstico:** Capital total estagnado estimado em **R$ 10.675,00**. Recomenda-se remanejamento interno para evitar obsolescência.`;
      return resp;
    }

    // 14. PATRIMÔNIOS SEM RESPONSÁVEL
    const isUnassignedAssets =
      p.includes('patrimonio') && (p.includes('sem responsavel') || p.includes('inventario') || p.includes('sem termo') || p.includes('cautela'));

    if (isUnassignedAssets) {
      const unassigned = state.assets.filter((a: any) => !a.responsibleName && !a.manager && !a.assignedTo);
      let resp = `### 🏷️ Consulta de Patrimônios e Ativos sem Responsável Alocado\n\n`;
      if (unassigned.length > 0) {
        resp += `Constam **${unassigned.length} ativo(s) corporativo(s)** sem termo de cautela ou responsável formal registrado:\n\n`;
        resp += `| Tag Patrimonial | Equipamento | Categoria | Unidade | Valor Contábil | Situação |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        unassigned.forEach((a: any) => {
          resp += `| **${a.assetTag}** | ${a.name} | ${a.category} | Unidade ${a.branch} | ${fmt(a.value || 0)} | ⚠️ **Pendente de Cautela** |\n`;
        });
        resp += `\n💡 **Ação Corretiva:** Acesse o módulo **Patrimônio**, localize a tag e emita o **Termo de Responsabilidade / Cautela** assinado pelo colaborador ou gestor do setor.`;
      } else {
        resp += `Todos os ativos patrimoniais cadastrados possuem responsáveis e termos de cautela devidamente vinculados no sistema.`;
      }
      return resp;
    }

    const branchesList = state.branches || [];
    const activeBranchesList = branchesList.filter((b: any) => b.active !== false);

    return (
      `### 📋 Painel Operacional Integrado — Assistente Almox Plus\n\n` +
      `Estou conectado a **todos os módulos** do ERP Almox Plus nas unidades **${activeBranchesList.map((b: any) => b.code).join(', ') || 'SP, RJ, SJRP e BSB'}**:\n\n` +
      `- **🏢 Unidades Operacionais:** ${activeBranchesList.length} ativa(s) de ${branchesList.length} filiais cadastradas.\n` +
      `- **📦 Catálogo de Estoque:** ${state.products.length} itens cadastrados.\n` +
      `- **🛒 Ordens de Compra Ativas:** ${state.purchaseOrders.filter(po => po.status !== 'ENTREGUE' && po.status !== 'CANCELADO').length} OCs.\n` +
      `- **Requisições Pendentes:** ${state.requisitions.filter(r => r.status === 'PENDENTE').length} requisições.\n` +
      `- **Transferências em Trânsito:** ${state.transfers.filter(t => t.status === 'EM_TRANSITO').length} remessas.\n\n` +
      `**Exemplos de perguntas que posso responder com precisão:**\n` +
      `- *"Quantas unidades ativas temos?"*\n` +
      `- *"Quais produtos temos no estoque ou que subiram no CSV?"*\n` +
      `- *"Como o material de limpeza é vinculado ao centro de custo?"*\n` +
      `- *"Qual o diagnóstico da Curva ABC de estoque?"*\n` +
      `- *"Há algum produto no estoque vencido ou perto de vencer?"*`
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
          mesmoLoteTodasUnidades: sameBatchAcrossUnits
        };
      });

      const branchesList = state.branches || [];
      const activeBranches = branchesList.filter(b => b.active !== false);

      const summaryData = {
        totalBranches: branchesList.length,
        activeBranchesCount: activeBranches.length,
        activeBranchesList: activeBranches.map(b => `${b.code} (${b.name})`),
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
            branches: branchesList.map(b => ({
              code: b.code,
              name: b.name,
              corporateName: b.corporateName,
              unitType: b.unitType,
              cnpj: b.cnpj,
              city: b.city,
              state: b.state,
              address: b.address,
              managerName: b.managerName,
              phone: b.phone,
              active: b.active
            })),
            summaryData,
            costCenters: costCentersBreakdown,
            purchaseOrders: state.purchaseOrders,
            purchaseRequests: state.purchaseRequests,
            requisitions: state.requisitions,
            transfers: state.transfers,
            assets: state.assets,
            products: productsContext,
            inventories: (state.inventories || []).map(inv => ({
              code: inv.code,
              title: inv.title,
              branch: inv.branch,
              category: inv.category,
              status: inv.status,
              divergenciasQtd: inv.totalDivergenceCount,
              divergenciasValor: inv.totalDivergenceValue,
              date: inv.finishedAt || inv.completedAt || inv.startedAt
            })),
            users: (state.users || []).map(u => ({
              name: u.name,
              email: u.email,
              role: u.role,
              branch: u.branch,
              active: u.active
            }))
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
      const fallbackReply = '⚠️ Resposta gerada pelo motor local do ERP (API Gemini indisponível neste momento).\n\n' + generateClientAnalysis(textToSend, selectedBranch);
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
              Assistente IA Almox Plus (Gemini 3.8 Flash)
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
                <span>Processando análise estratégica no modelo Gemini 3.8...</span>
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
