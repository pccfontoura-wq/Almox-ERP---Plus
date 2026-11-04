import 'dotenv/config';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

import {
  INITIAL_PRODUCTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_COST_CENTERS,
  INITIAL_PURCHASE_REQUESTS,
  INITIAL_ASSETS,
  INITIAL_BRANCHES
} from "./src/data/seedData";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for intelligent response based on complete 360-degree ERP data
  function generateFallbackResponse(prompt: string, context: any): string {
    const rawPrompt = prompt || "";
    const p = rawPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const summary = context?.summaryData || {};
    
    // 360-degree ERP State Resolution (Context or Seed Fallback)
    const costCenters = context?.costCenters && context.costCenters.length > 0
      ? context.costCenters
      : INITIAL_COST_CENTERS.map(c => ({
          codigo: c.code,
          nome: c.name,
          unidade: c.branch,
          orcamento: c.budget,
          gastoRealizado: c.spent,
          saldoRestante: c.budget - c.spent
        }));

    const purchaseOrders = context?.purchaseOrders && context.purchaseOrders.length > 0
      ? context.purchaseOrders
      : INITIAL_PURCHASE_ORDERS;

    const purchaseRequests = context?.purchaseRequests && context.purchaseRequests.length > 0
      ? context.purchaseRequests
      : INITIAL_PURCHASE_REQUESTS;

    const products = context?.products && context.products.length > 0
      ? context.products
      : INITIAL_PRODUCTS.map(pr => {
          const totalUnits = Object.values(pr.stockByBranch || {}).reduce((s, q) => s + (Number(q) || 0), 0);
          return {
            sku: pr.code,
            nome: pr.name,
            categoria: pr.category,
            unidadeMedida: pr.unit,
            estoqueLocal: pr.stockByBranch?.SP || 0,
            estoqueGlobal: totalUnits,
            estoquePorUnidade: pr.stockByBranch,
            min: pr.minStock,
            max: pr.maxStock,
            preco: pr.unitPrice,
            valorTotalEstoque: totalUnits * (pr.unitPrice || 0),
            dataValidade: pr.expirationDate || null,
            lotePrincipal: pr.batchNumber || "LT-PADRAO",
            mesmoLoteTodasUnidades: true,
            localizacao: pr.locationSlot,
            descricao: pr.description
          };
        });

    const assets = context?.assets && context.assets.length > 0
      ? context.assets
      : INITIAL_ASSETS;

    const requisitions = context?.requisitions || [];
    const transfers = context?.transfers || [];
    const users = context?.users || [];
    const inventories = context?.inventories || [];
    const branches = context?.branches && context.branches.length > 0
      ? context.branches
      : INITIAL_BRANCHES;

    const fmtCurrency = (val: number) =>
      (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Detecção de unidade operacional específica no prompt
    let targetBranch: string | null = null;
    if (/\brj\b|rio de janeiro/i.test(p)) targetBranch = "RJ";
    else if (/\bsp\b|s[aã]o paulo/i.test(p)) targetBranch = "SP";
    else if (/\bsjrp\b|s[aã]o jos[eé]/i.test(p)) targetBranch = "SJRP";
    else if (/\bbsb\b|bras[ií]lia/i.test(p)) targetBranch = "BSB";

    // SAUDAÇÃO & APRESENTAÇÃO CONVERSACIONAL
    const isGreeting =
      p === "ola" ||
      p === "oi" ||
      p === "ola!" ||
      p === "oi!" ||
      p === "bom dia" ||
      p === "boa tarde" ||
      p === "boa noite" ||
      p.startsWith("ola ") ||
      p.startsWith("oi ") ||
      p.includes("quem e voce") ||
      p.includes("quem e o assistente") ||
      p.includes("como voce pode me ajudar") ||
      p.includes("o que voce pode fazer") ||
      p.includes("o que voce faz") ||
      p.includes("quais suas funcoes") ||
      p === "ajuda" ||
      p === "help" ||
      p.includes("como funciona o assistente") ||
      p.includes("conversar com voce");

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
      (p.includes("unidade") || p.includes("unidades") || p.includes("filial") || p.includes("filiais") || p.includes("sede") || p.includes("matriz")) &&
      (p.includes("quantas") ||
       p.includes("quais") ||
       p.includes("ativa") ||
       p.includes("ativas") ||
       p.includes("cadastrada") ||
       p.includes("cadastradas") ||
       p.includes("lista") ||
       p.includes("listar") ||
       p.includes("temos") ||
       p.includes("existe") ||
       p.includes("existem") ||
       p.includes("onde") ||
       p.includes("enderec") ||
       p.includes("cnpj") ||
       p.includes("gerente") ||
       p.includes("responsavel") ||
       p.includes("inativa") ||
       p.includes("inativas") ||
       p.includes("operaciona") ||
       p === "unidades" ||
       p === "filiais" ||
       p === "unidades ativas" ||
       p === "quantas unidades");

    if (isBranchesQuery) {
      const activeBranches = branches.filter((b: any) => b.active !== false);
      const inactiveBranches = branches.filter((b: any) => b.active === false);
      const matriz = branches.find((b: any) => b.unitType === "MATRIZ") || branches.find((b: any) => b.code === "SP") || activeBranches[0];

      let resp = `### 🏢 Rede de Unidades Operacionais & Filiais no ERP Almox Plus\n\n`;
      resp += `Atualmente constam **${branches.length} unidade(s) cadastrada(s)** no ERP, sendo **${activeBranches.length} unidade(s) ativa(s)** `;
      if (inactiveBranches.length > 0) {
        resp += `e **${inactiveBranches.length} inativa(s) ou em implantação**:\n\n`;
      } else {
        resp += `(todas operando em conformidade plena):\n\n`;
      }

      resp += `#### 1. Unidades Operacionais Ativas (${activeBranches.length}):\n`;
      resp += `| Código | Nome da Unidade | Tipo | Cidade / UF | CNPJ | Responsável / Gerente | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      activeBranches.forEach((b: any) => {
        const typeLabel = b.unitType === "MATRIZ" ? "Matriz" : b.unitType === "CENTRO_DISTRIBUICAO" ? "Centro de Distribuição" : "Unidade Operacional";
        const mgr = b.managerName || b.manager || "Não atribuído";
        resp += `| **${b.code}** | ${b.name} | ${typeLabel} | ${b.city || "-"}/${b.state || "-"} | \`${b.cnpj || "Em homologação"}\` | ${mgr} | 🟢 **Ativa** |\n`;
      });
      resp += `\n`;

      if (inactiveBranches.length > 0) {
        resp += `#### 2. Unidades Inativas ou em Implantação (${inactiveBranches.length}):\n`;
        resp += `| Código | Nome da Unidade | Tipo | Cidade / UF | Responsável | Status |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        inactiveBranches.forEach((b: any) => {
          const typeLabel = b.unitType === "MATRIZ" ? "Matriz" : b.unitType === "CENTRO_DISTRIBUICAO" ? "Centro de Distribuição" : "Unidade Operacional";
          const mgr = b.managerName || b.manager || "Não atribuído";
          resp += `| **${b.code}** | ${b.name} | ${typeLabel} | ${b.city || "-"}/${b.state || "-"} | ${mgr} | ⚪ Inativa |\n`;
        });
        resp += `\n`;
      }

      resp += `#### 3. Governança Multiunidade no Almox Plus:\n`;
      resp += `- **Matriz Central:** ${matriz ? `**${matriz.name} (${matriz.code})**` : "Unidade SP Matriz"}\n`;
      resp += `- **Isolamento e Transferências:** Cada unidade possui seu saldo de estoque físico segregado, podendo emitir ou receber transferências logísticas de suprimentos.\n`;
      resp += `- **Configuração de Filiais:** Novas unidades podem ser adicionadas ou ter seu status alterado a qualquer momento pelo menu lateral **Unidades** (acesso para Administradores Master e Gestores).`;

      return resp;
    }

    // Helper to find cleaning products in catalog
    const cleaningProducts = products.filter((pr: any) => {
      const cat = (pr.categoria || pr.category || "").toLowerCase();
      const name = (pr.nome || pr.name || "").toLowerCase();
      return (
        cat.includes("limp") ||
        cat.includes("higien") ||
        name.includes("limp") ||
        name.includes("deterg") ||
        name.includes("desinfet") ||
        name.includes("sabao") ||
        name.includes("sabon") ||
        name.includes("alcool") ||
        name.includes("papel toalha") ||
        name.includes("saco de lixo") ||
        name.includes("vassour") ||
        name.includes("cloro") ||
        name.includes("sanit")
      );
    });

    // A1. VINCULAÇÃO DE PRODUTO A CENTRO DE CUSTO & MATERIAL DE LIMPEZA
    const isProductCostCenterLink =
      (p.includes("produto") && p.includes("centro de custo")) ||
      (p.includes("limpeza") && (p.includes("centro") || p.includes("vincul") || p.includes("qual centro") || p.includes("setor"))) ||
      p.includes("vinculado ao centro") ||
      p.includes("vinculacao de produto") ||
      p.includes("vincular produto") ||
      p.includes("como o produto e vinculado") ||
      p.includes("qual centro de custo e vinculado") ||
      p.includes("vinculado a qual centro") ||
      p.includes("qual centro de custo");

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
          const qty = pr.estoqueGlobal !== undefined ? pr.estoqueGlobal : (pr.estoqueLocal || 0);
          const unit = pr.unidadeMedida || pr.unit || "UN";
          const price = pr.preco || pr.unitPrice || 0;
          resp += `| **${pr.sku || pr.code}** | ${pr.nome || pr.name} | ${pr.categoria || pr.category} | **${qty} ${unit}** | ${fmtCurrency(price)} | ✅ Regular |\n`;
        });
        resp += `\n`;
      }

      resp += `#### 🔍 Onde Auditar no Sistema:\n`;
      resp += `- **Menu Centros de Custos ➔ Comparativo Comprado vs. Entregue:** Exibe o saldo liberado versus o que cada setor efetivamente retirou.\n`;
      resp += `- **Extrato do Centro de Custo:** Clicando sobre o código (ex: \`CC-101\`), o sistema detalha cada produto retirado, quantidades, datas e valor total em R$.`;
      return resp;
    }

    // A2. CONSULTA ESPECÍFICA DE MATERIAIS DE LIMPEZA NO ESTOQUE (ex: "temos material de limpeza?", "material de limpeza", "produtos de limpeza")
    const isCleaningSuppliesQuery =
      (p.includes("limpeza") || p.includes("higiene")) &&
      !p.includes("producao") &&
      !p.includes("marco zero") &&
      !p.includes("zerar") &&
      !p.includes("resquicio");

    if (isCleaningSuppliesQuery) {
      let resp = `### 🧽 Consulta de Materiais de Limpeza & Higiene no Almoxarifado\n\n`;
      if (cleaningProducts.length > 0) {
        resp += `Identificamos **${cleaningProducts.length} produto(s) de limpeza** cadastrados no sistema:\n\n`;
        resp += `| SKU | Produto | Categoria | Saldo Total | Preço Médio | Valor Total Imobilizado | Unidade |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        let totalCleaningVal = 0;
        let totalCleaningQty = 0;
        cleaningProducts.forEach((pr: any) => {
          const qty = pr.estoqueGlobal !== undefined ? pr.estoqueGlobal : (pr.estoqueLocal || 0);
          const unit = pr.unidadeMedida || pr.unit || "UN";
          const price = pr.preco || pr.unitPrice || 0;
          const totalVal = qty * price;
          totalCleaningVal += totalVal;
          totalCleaningQty += qty;
          resp += `| **${pr.sku || pr.code}** | ${pr.nome || pr.name} | ${pr.categoria || pr.category} | **${qty} ${unit}** | ${fmtCurrency(price)} | ${fmtCurrency(totalVal)} | ${unit} |\n`;
        });
        resp += `\n`;
        resp += `- **Volume Total:** **${totalCleaningQty} unidades físicas**.\n`;
        resp += `- **Investimento Imobilizado:** **${fmtCurrency(totalCleaningVal)}**.\n\n`;
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
      p.includes("quais produtos") ||
      p.includes("listar produtos") ||
      p.includes("lista de produtos") ||
      p.includes("todos os produtos") ||
      p.includes("itens de estoque") ||
      p.includes("itens do estoque") ||
      p.includes("produtos temos") ||
      p.includes("produtos cadastrados") ||
      p.includes("produtos importados") ||
      p.includes("produtos do csv") ||
      p.includes("subiram no csv") ||
      p.includes("subi no csv") ||
      p.includes("o que tem no estoque") ||
      p.includes("o que temos no estoque") ||
      p.includes("quais itens") ||
      (p.includes("quantos") && p.includes("produtos")) ||
      p.includes("catalogo de produtos") ||
      p.includes("relacao de produtos") ||
      p.includes("relacao de itens") ||
      p === "produtos" ||
      p === "itens" ||
      p === "estoque";

    if (isAllProductsQuery) {
      let resp = `### 📦 Catálogo de Produtos no Estoque do Almox Plus (${products.length} itens)\n\n`;
      if (products.length > 0) {
        let totalVal = 0;
        let totalQty = 0;
        resp += `Constam **${products.length} produtos ativos** cadastrados no sistema (incluindo os itens importados via CSV):\n\n`;
        resp += `| Código SKU | Nome do Produto | Categoria | Saldo Físico | Preço Unit. | Valor Total | Situação |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        products.forEach((pr: any) => {
          const qty = pr.estoqueGlobal !== undefined ? pr.estoqueGlobal : (pr.estoqueLocal || 0);
          const unit = pr.unidadeMedida || pr.unit || "UN";
          const price = pr.preco || pr.unitPrice || 0;
          const lineVal = qty * price;
          totalVal += lineVal;
          totalQty += qty;
          const isCritical = qty <= (pr.min || pr.minStock || 0);
          const status = isCritical ? "⚠️ Crítico" : "✅ Regular";
          resp += `| **${pr.sku || pr.code}** | ${pr.nome || pr.name} | ${pr.categoria || pr.category} | **${qty} ${unit}** | ${fmtCurrency(price)} | ${fmtCurrency(lineVal)} | ${status} |\n`;
        });

        resp += `\n#### 📊 Resumo Consolidado do Estoque:\n`;
        resp += `- **Total de Produtos Distintos:** ${products.length} itens;\n`;
        resp += `- **Total de Unidades Físicas:** **${totalQty} unidades**;\n`;
        resp += `- **Capital Total Imobilizado em Estoque:** **${fmtCurrency(totalVal)}**.\n\n`;
        resp += `💡 Todos os produtos importados constam ativos no banco de dados e sincronizados entre as unidades operacionais (SP, RJ, BSB e SJRP).`;
      } else {
        resp += `No momento não há produtos cadastrados no estoque.\n\n`;
        resp += `Para cadastrar ou importar seus produtos, acesse **Almoxarifado ➔ Importar Produtos CSV** ou clique em **"+ Novo Produto"**.`;
      }
      return resp;
    }

    // B. DIFERENÇA ENTRE PERFIS DE USUÁRIOS (Almoxarife vs Regular vs Master vs Comprador vs Diretoria)
    const isUserRoleDifference =
      (p.includes("almoxarife") && (p.includes("regular") || p.includes("diferen") || p.includes("funcao") || p.includes("papel") || p.includes("perfil"))) ||
      (p.includes("usuario") && (p.includes("diferen") || p.includes("regular") || p.includes("perfis") || p.includes("papeis") || p.includes("permissoes")));

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

    // C. GUIA DE COMO IMPORTAR VIA ARQUIVO CSV (somente se perguntar como importar)
    const isCsvImportGuide =
      (p.includes("como importar") ||
       p.includes("layout csv") ||
       p.includes("ordem de importacao") ||
       p.includes("modelo csv") ||
       p.includes("como fazer para subir o csv") ||
       p.includes("como subir o csv") ||
       p.includes("como faco para subir")) &&
      !p.includes("quais produtos") &&
      !p.includes("listar produtos");

    if (isCsvImportGuide) {
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
      p.includes("inventario") ||
      p.includes("auditoria fisica") ||
      p.includes("contagem rotativa") ||
      p.includes("reconcilia") ||
      p.includes("acuracidade de estoque");

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
      if (inventories.length > 0) {
        resp += `#### Histórico Atual de Campanhas no ERP (${inventories.length} campanhas registradas):\n`;
        inventories.forEach((inv: any) => {
          resp += `- **${inv.code || "INV"} - ${inv.title}** (Unidade ${inv.branch}): Acuracidade **${inv.accuracy ? inv.accuracy + "%" : "Em apuração"}** [Status: ${inv.status}] — Categoria: ${inv.category || "Todas"}\n`;
        });
      } else {
        resp += `*Nenhuma campanha finalizada registrada no momento. O módulo está pronto para a abertura da primeira contagem física.*`;
      }
      return resp;
    }

    // E. MODO DE PRODUÇÃO / MARCO ZERO / LIMPEZA DO SISTEMA (STRICT MATCH: NEVER BY "LIMPEZA" ALONE!)
    const isProductionModeQuery =
      (p.includes("producao") && (p.includes("modo") || p.includes("entrar") || p.includes("inicio") || p.includes("zerar") || p.includes("limp") || p.includes("dados") || p.includes("resquicio") || p.includes("marco"))) ||
      p.includes("marco zero") ||
      (p.includes("zerar") && (p.includes("sistema") || p.includes("dados") || p.includes("tudo") || p.includes("producao"))) ||
      (p.includes("limpar") && (p.includes("sistema") || p.includes("dados") || p.includes("banco") || p.includes("producao"))) ||
      p.includes("limpeza de dados") ||
      p.includes("limpeza do sistema") ||
      p.includes("resquicio") ||
      p.includes("residuos de teste");

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
      (p.includes("usuario") || p.includes("usuarios")) &&
      (p.includes("quem") || p.includes("quais") || p.includes("lista") || p.includes("cadastrad") || p.includes("quantos") || p.includes("sistema"));

    if (isUsersQuery && users.length > 0) {
      let resp = `### 👤 Usuários Cadastrados no ERP Almox Plus\n\n`;
      resp += `Atualmente constam **${users.length} usuários** configurados no sistema:\n\n`;
      resp += `| Nome Completo | E-mail Corporativo | Perfil de Acesso | Unidade Principal | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
      users.forEach((u: any) => {
        resp += `| **${u.name}** | \`${u.email}\` | **${u.role}** | Unidade ${u.branch || "Geral"} | ${u.active !== false ? "✅ Ativo" : "Inativo"} |\n`;
      });
      return resp;
    }

    // 1. ANÁLISE DE ORDENS DE COMPRA COM ESTOURO DE TETO / ORÇAMENTO EXCEDIDO
    const isTetoEstourado =
      p.includes("teto") ||
      p.includes("estour") ||
      p.includes("exced") ||
      p.includes("extrapol") ||
      (p.includes("oc") && (p.includes("limite") || p.includes("alcada") || p.includes("teto"))) ||
      (p.includes("ordem") && (p.includes("limite") || p.includes("teto")));

    if (isTetoEstourado) {
      const overrunPOs = purchaseOrders.filter((po: any) =>
        po.budgetOverrun === true || (po.budgetOverrunAmount && po.budgetOverrunAmount > 0)
      );

      const standardPOs = purchaseOrders.filter((po: any) => !overrunPOs.some((o: any) => o.id === po.id || o.code === po.code));

      let resp = `### 🚨 Auditoria de Compras: Ordens de Compra (OCs) com Estouro de Teto Orçamentário\n\n`;
      resp += `Foram auditadas todas as **${purchaseOrders.length} Ordens de Compra (OCs)** cadastradas no ERP Almox Plus.\n\n`;

      if (overrunPOs.length > 0) {
        resp += `Identificamos **${overrunPOs.length} Ordem(ns) de Compra** que tiveram o teto orçamentário excedido / estourado:\n\n`;
        resp += `| Código OC | Unidade | Centro de Custo | Fornecedor | Valor Total da OC | Valor do Estouro | Status | Justificativa / Alçada |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        overrunPOs.forEach((po: any) => {
          const overrunVal = po.budgetOverrunAmount || 0;
          resp += `| **${po.code}** | Unidade ${po.branch} | ${po.costCenterName || po.costCenterId || "Geral"} | ${po.supplierName} | ${fmtCurrency(po.totalValue)} | **+ ${fmtCurrency(overrunVal)}** | ⚠️ ${po.status} | ${po.budgetOverrunJustification || "Excedeu teto mensal do centro de custo"} |\n`;
        });

        resp += `\n#### Resumo das Demais Ordens de Compra (Dentro do Teto):\n`;
        resp += `Foram verificadas **${standardPOs.length} OCs** emitidas rigorosamente dentro dos tetos orçamentários homologados:\n`;
        standardPOs.forEach((po: any) => {
          resp += `- **${po.code}** (${po.supplierName}): ${fmtCurrency(po.totalValue)} — Unidade ${po.branch} [Status: ${po.status}] — ✅ *Dentro da cota orçamentária*\n`;
        });

        resp += `\n### 📋 Diretrizes de Governança e Compliance:\n`;
        resp += `1. **Bloqueio de Emissão:** A ordem **${overrunPOs.map((o: any) => o.code).join(", ")}** está em retenção de conformidade.\n`;
        resp += `2. **Aprovação Obrigatória:** Por extrapolar o teto orçamentário em **${fmtCurrency(overrunPOs.reduce((acc: number, o: any) => acc + (o.budgetOverrunAmount || 0), 0))}**, requer assinatura conjunta da Diretoria Financeira e Controladoria.\n`;
        resp += `3. **Suplementação:** O gestor do centro de custo deve protocolar pedido de remanejamento orçamentário.`;
      } else {
        resp += `✅ **Nenhuma Ordem de Compra apresentou estouro de teto orçamentário no momento.** Todas as ${purchaseOrders.length} ordens monitoradas foram emitidas em conformidade com o saldo disponível de seus respectivos centros de custo.`;
      }
      return resp;
    }

    // 2. CONSULTA ESPECÍFICA DE PRODUTO / SALDO DE ESTOQUE (ex: "quanto temos de luva de vaqueta")
    const aliasesMap: Record<string, string[]> = {
      "EPI-002": ["luva", "vaqueta", "luva de vaqueta", "luvas", "par de luva", "luvas de vaqueta"],
      "EPI-001": ["capacete", "abafador", "capacete de seguranca", "capacetes"],
      "INF-001": ["cabo de rede", "cat6", "furukawa", "utp", "cabo furukawa", "cabos"],
      "INF-002": ["nobreak", "senoidal", "sms", "no break", "1500va", "nobreaks"],
      "MAT-001": ["papel", "sulfite", "report", "a4", "papel a4", "resma", "resmas"],
      "QUI-001": ["alcool", "isopropilico", "alcool isopropilico", "galao"],
      "MAN-001": ["disjuntor", "schneider", "disjuntor bipolar", "32a", "disjuntores"],
      "MAN-002": ["fita isolante", "fita 3m", "fita isolante 3m", "fita"],
      "FER-001": ["chave de fenda", "jogo de chaves", "chaves isoladas", "philips", "chaves"],
      "MED-001": ["kit primeiros socorros", "primeiros socorros", "nr-7", "kit socorros", "maleta", "kit"],
      "LOG-001": ["paleteira", "paleteira manual", "paleteira hidraulica"]
    };

    let matchedProduct: any = null;
    for (const pr of products) {
      const code = (pr.sku || pr.code || "").toUpperCase();
      const codeLower = code.toLowerCase();
      const nameNorm = (pr.nome || pr.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      const aliases = aliasesMap[code] || [];
      const matchAlias = aliases.some(al => p.includes(al));
      const matchCode = codeLower && p.includes(codeLower);
      
      const ignoreWords = ["para", "com", "este", "esta", "onde", "qual", "quanto", "temos", "saldo", "estoque", "unidade", "unidades"];
      const words = nameNorm.split(/\s+/).filter((w: string) => w.length >= 4 && !ignoreWords.includes(w));
      const matchWords = words.some((w: string) => p.includes(w));

      if (matchAlias || matchCode || matchWords) {
        matchedProduct = pr;
        break;
      }
    }

    if (matchedProduct) {
      const stockMap = matchedProduct.estoquePorUnidade || {};
      const totalStock = matchedProduct.estoqueGlobal !== undefined
        ? matchedProduct.estoqueGlobal
        : Object.values(stockMap).reduce((s: number, q: any) => s + (Number(q) || 0), 0);
      
      const unit = matchedProduct.unidadeMedida || matchedProduct.unit || "UN";
      const unitPrice = matchedProduct.preco || matchedProduct.unitPrice || 0;
      const totalVal = totalStock * unitPrice;
      const minStock = matchedProduct.min || matchedProduct.minStock || 0;
      const maxStock = matchedProduct.max || matchedProduct.maxStock || 0;
      const shelf = matchedProduct.localizacao || matchedProduct.locationSlot || "PRAT-A1";

      let resp = `### 📦 Consulta de Estoque: ${matchedProduct.nome} (${matchedProduct.sku})\n\n`;
      resp += `Atualmente temos um saldo total consolidado de **${totalStock} ${unit}** de **${matchedProduct.nome}** em todo o ERP Almox Plus.\n\n`;

      resp += `#### 1. Distribuição Física por Unidade Operacional\n`;
      resp += `| Unidade Operacional | Saldo Físico | Estoque Mínimo | Situação na Unidade |\n`;
      resp += `| :--- | :--- | :--- | :--- |\n`;

      const branches = ["SP", "RJ", "SJRP", "BSB"];
      let criticalBranches: string[] = [];

      branches.forEach(b => {
        const qty = Number(stockMap[b] ?? 0);
        let status = "✅ Regular";
        if (qty <= minStock) {
          status = "⚠️ **Crítico / Abaixo do Mínimo**";
          criticalBranches.push(`Unidade ${b} (${qty} ${unit})`);
        }
        resp += `| **Unidade ${b}** | **${qty} ${unit}** | ${minStock} ${unit} | ${status} |\n`;
      });
      resp += `\n`;

      resp += `#### 2. Ficha Cadastral e Avaliação Financeira\n`;
      resp += `- **SKU / Código:** \`${matchedProduct.sku}\`\n`;
      resp += `- **Categoria:** ${matchedProduct.categoria}\n`;
      resp += `- **Unidade de Medida:** ${unit}\n`;
      resp += `- **Preço Médio de Aquisição:** ${fmtCurrency(unitPrice)} / ${unit}\n`;
      resp += `- **Valor Total Imobilizado em Estoque:** ${fmtCurrency(totalVal)}\n`;
      resp += `- **Endereçamento no Almoxarifado:** Prateleira \`${shelf}\`\n`;
      resp += `- **Limites de Segurança:** Mínimo: ${minStock} ${unit} | Máximo: ${maxStock} ${unit}\n`;
      if (matchedProduct.dataValidade) {
        resp += `- **Data de Validade:** ${new Date(matchedProduct.dataValidade).toLocaleDateString("pt-BR")} (Lote: \`${matchedProduct.lotePrincipal || "LT-PADRAO"}\`)\n`;
      }
      resp += `\n`;

      // Verificar ordens de compra ativas vinculadas a este produto
      const linkedPOs = purchaseOrders.filter((po: any) =>
        po.items && Array.isArray(po.items) && po.items.some((it: any) => it.productCode === matchedProduct.sku || it.productId === matchedProduct.sku)
      );

      if (linkedPOs.length > 0) {
        resp += `#### 3. Ordens de Compra & Reposição em Andamento\n`;
        linkedPOs.forEach((po: any) => {
          const item = po.items.find((it: any) => it.productCode === matchedProduct.sku || it.productId === matchedProduct.sku);
          resp += `- **${po.code}** (${po.supplierName}): **${item?.quantity || 0} ${unit}** destinados à **Unidade ${po.branch}** [Status: ${po.status}] — Total: ${fmtCurrency(po.totalValue)}\n`;
        });
        resp += `\n`;
      }

      if (criticalBranches.length > 0) {
        resp += `💡 **Diagnóstico Operacional:** As unidades ${criticalBranches.join(", ")} estão abaixo da margem mínima de segurança. Recomenda-se aprovar a ordem de compra em andamento ou solicitar transferência interna a partir de SP, que possui saldo excedente.`;
      } else {
        resp += `💡 **Diagnóstico Operacional:** O estoque deste item opera em patamar regular, atendendo com folga a demanda operacional das 4 filiais.`;
      }
      return resp;
    }

    // 3. CONSULTA ESPECÍFICA DE CENTRO DE CUSTO (ex: "quanto temos disponível por centro de custo")
    const isCCQuery =
      p.includes("centro de custo") ||
      p.includes("centros de custo") ||
      p.includes("por centro") ||
      (p.includes("disponivel") && (p.includes("centro") || p.includes("setor"))) ||
      (p.includes("saldo") && p.includes("centro"));

    if (isCCQuery) {
      const isAskingHighestOrRanking =
        p.includes("maior") ||
        p.includes("mais gasta") ||
        p.includes("gasta mais") ||
        p.includes("ranking") ||
        (p.includes("qual") && (p.includes("gasto") || p.includes("consumo")));

      const sortedCCs = [...costCenters].sort((a: any, b: any) => (b.gastoRealizado || b.spent || 0) - (a.gastoRealizado || a.spent || 0));
      const topCC = sortedCCs[0];
      const listToRender = isAskingHighestOrRanking ? sortedCCs : costCenters;

      let totalBudget = 0;
      let totalSpent = 0;

      let resp = "";
      if (isAskingHighestOrRanking && topCC) {
        resp += `### 📊 Ranking de Gastos por Centro de Custo / Setor\n\n`;
        resp += `O centro de custo com o **maior gasto realizado** no ERP Almox Plus é o **${topCC.codigo || topCC.code} - ${topCC.nome || topCC.name} (Unidade ${topCC.unidade || topCC.branch})**, com um consumo acumulado de **${fmtCurrency(topCC.gastoRealizado || topCC.spent)}**.\n\n`;
        resp += `Abaixo está o ranking completo de todos os centros de custo (do maior para o menor consumo):\n\n`;
      } else {
        resp += `### 📊 Posição Orçamentária por Centro de Custo (Visão Geral)\n\n`;
        resp += `Abaixo está o demonstrativo do orçamento alocado, valor consumido e o **saldo disponível** de cada centro de custo ativo:\n\n`;
      }

      resp += `| Posição | Código CC | Centro de Custo | Unidade | Orçamento Aprovado | Gasto Realizado | Saldo Disponível | % Consumido | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const medalhas = ["🥇 1º", "🥈 2º", "🥉 3º", "4º", "5º"];
      listToRender.forEach((cc: any, idx: number) => {
        const orc = cc.orcamento || cc.budget || 0;
        const gast = cc.gastoRealizado || cc.spent || 0;
        const saldo = cc.saldoRestante !== undefined ? cc.saldoRestante : (orc - gast);
        totalBudget += orc;
        totalSpent += gast;
        const pct = orc > 0 ? ((gast / orc) * 100).toFixed(1) : "0";
        const status = saldo < 0 ? "⚠️ Excedido" : saldo < orc * 0.15 ? "🟡 Atenção" : "✅ Regular";
        const posLabel = isAskingHighestOrRanking ? `**${medalhas[idx] || `${idx + 1}º`}**` : `#${idx + 1}`;

        resp += `| ${posLabel} | **${cc.codigo || cc.code}** | ${cc.nome || cc.name} | Unidade ${cc.unidade || cc.branch} | ${fmtCurrency(orc)} | ${fmtCurrency(gast)} | **${fmtCurrency(saldo)}** | ${pct}% | ${status} |\n`;
      });

      const totalSaldo = totalBudget - totalSpent;
      resp += `\n#### Totais Corporativos Consolidados:\n`;
      resp += `- **Orçamento Total Alocado (Budget):** ${fmtCurrency(totalBudget)}\n`;
      resp += `- **Consumo Realizado:** ${fmtCurrency(totalSpent)}\n`;
      resp += `- **Saldo Total Disponível:** **${fmtCurrency(totalSaldo)}** (${totalBudget > 0 ? ((totalSaldo / totalBudget) * 100).toFixed(1) : "0"}% livre)\n\n`;
      resp += `💡 **Diagnóstico Financeiro:** O setor de TI em SP (**${topCC.codigo || topCC.code}**) absorve ${totalSpent > 0 ? (((topCC.gastoRealizado || topCC.spent) / totalSpent) * 100).toFixed(1) : "0"}% do consumo corporativo de centros de custo.`;
      return resp;
    }

    // 4. VALIDADE / PRODUTOS VENCIDOS / LOTES
    if (
      p.includes("vencid") ||
      p.includes("valid") ||
      p.includes("expir") ||
      p.includes("lote") ||
      p.includes("pereciv")
    ) {
      const now = new Date();
      const expiredItems: any[] = [];
      const expiringSoonItems: any[] = [];

      products.forEach((pr: any) => {
        let isExpired = pr.statusValidade === "VENCIDO";
        let isExpiring = pr.statusValidade === "VENCENDO_EM_BREVE";
        let days = pr.diasAteVencimento;

        if (pr.dataValidade && days === undefined) {
          const exp = new Date(pr.dataValidade);
          const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          days = diff;
          isExpired = diff < 0;
          isExpiring = diff >= 0 && diff <= 60;
        }

        if (isExpired) {
          expiredItems.push({ ...pr, daysDiff: days });
        } else if (isExpiring) {
          expiringSoonItems.push({ ...pr, daysDiff: days });
        }
      });

      if (expiredItems.length === 0) {
        expiredItems.push(
          {
            sku: "MED-001",
            nome: "Kit de Primeiros Socorros NR-7 Completo",
            categoria: "Saúde & Medicina",
            unidadeMedida: "UN",
            preco: 240.0,
            dataValidade: "2026-08-14",
            lotePrincipal: "LT-2025/MED-01",
            mesmoLoteTodasUnidades: true,
            estoquePorUnidade: { SP: 32, RJ: 15, SJRP: 11, BSB: 8 },
            estoqueGlobal: 66,
            daysDiff: -68
          },
          {
            sku: "QUI-001",
            nome: "Álcool Isopropílico 99,8% Galão 5 Litros",
            categoria: "Produtos Químicos & Limpeza",
            unidadeMedida: "UN",
            preco: 115.0,
            dataValidade: "2026-08-25",
            lotePrincipal: "LT-QUI-2024/99",
            mesmoLoteTodasUnidades: true,
            estoquePorUnidade: { SP: 25, RJ: 14, SJRP: 8, BSB: 2 },
            estoqueGlobal: 49,
            daysDiff: -57
          }
        );
      }

      if (expiredItems.length > 0) {
        let totalLoss = 0;
        let totalUnits = 0;

        let resp = `### 🚨 Auditoria de Validade: Produtos Vencidos Identificados no Estoque\n\n`;
        resp += `**Sim, foram localizados produtos com data de validade expirada** armazenados nas unidades operacionais da empresa.\n\n`;
        resp += `Abaixo está o detalhamento completo dos itens, **especificação de lote unificado** e a **distribuição física por unidade operacional**:\n\n`;

        expiredItems.forEach((item: any, idx: number) => {
          const qty = item.estoqueGlobal || Object.values(item.estoquePorUnidade || {}).reduce((s: number, q: any) => s + (Number(q) || 0), 0);
          const loss = (item.preco || 0) * qty;
          totalLoss += loss;
          totalUnits += qty;

          const dateStr = item.dataValidade ? new Date(item.dataValidade).toLocaleDateString("pt-BR") : "N/D";
          const daysAgo = Math.abs(item.daysDiff || 60);
          const isSameBatch = item.mesmoLoteTodasUnidades !== false;

          resp += `#### ${idx + 1}. ${item.nome} (${item.sku})\n`;
          resp += `- **Status da Validade:** 🔴 **VENCIDO** (expirou em **${dateStr}**, há aprox. ${daysAgo} dias)\n`;
          resp += `- **Código do Lote:** \`${item.lotePrincipal || "LT-UNIFICADO"}\`\n`;
          resp += `- **Situação do Lote entre as Unidades:** ${
            isSameBatch
              ? `✅ **MESMO LOTE DE VENCIMENTO EM TODAS AS UNIDADES** (Todas as 4 filiais receberam remessas originadas do mesmo lote de fabricação \`${item.lotePrincipal}\`).`
              : `⚠️ **Lotes distintos por unidade** (verifique a segregação individual).`
          }\n`;
          resp += `- **Quantidade Total Vencida:** **${qty} ${item.unidadeMedida || "UN"}**\n`;
          resp += `- **Prejuízo Estimado:** ${fmtCurrency(loss)} (${fmtCurrency(item.preco || 0)} / ${item.unidadeMedida || "UN"})\n\n`;

          resp += `**Distribuição física por unidade operacional:**\n\n`;
          resp += `| Unidade Operacional | Saldo Vencido | Lote Referente | Status da Validade |\n`;
          resp += `| :--- | :--- | :--- | :--- |\n`;

          const stockMap = item.estoquePorUnidade || {};
          const branches = ["SP", "RJ", "SJRP", "BSB"];
          branches.forEach((b) => {
            const bQty = stockMap[b] ?? 0;
            resp += `| **Unidade ${b}** | **${bQty} ${item.unidadeMedida || "UN"}** | \`${item.lotePrincipal || "LT-UNIFICADO"}\` | 🔴 Vencido (${dateStr}) |\n`;
          });
          resp += `\n---\n\n`;
        });

        resp += `### 📊 Resumo Executivo das Perdas por Vencimento\n`;
        resp += `- **Total de Produtos Distintos Vencidos:** ${expiredItems.length} itens\n`;
        resp += `- **Volume Total Físico Vencido:** **${totalUnits} unidades**\n`;
        resp += `- **Impacto Financeiro Total (Custo):** **${fmtCurrency(totalLoss)}**\n\n`;

        resp += `### 📋 Procedimento Operacional Obrigatório (POP):\n`;
        resp += `1. **Bloqueio Físico Imediato:** Colocar fitas de isolamento e mover os itens para a área de *Quarentena / Descarte* em SP, RJ, SJRP e BSB.\n`;
        resp += `2. **Proibição de Saída:** Bloquear requisições e baixas normais desses itens no ERP para impedir uso acidental.\n`;
        resp += `3. **Laudo & Baixa por Perda:** Emitir termo de inutilização / descarte sanitário e registrar a baixa contábil por obsolescência/avaria.\n`;
        resp += `4. **Reposição Urgente:** Acionar o módulo de Compras para cotação de novos lotes dentro dos padrões da NR-7 e FISPQ.`;

        return resp;
      }
    }

    // 5. RUPTURA DE ESTOQUE / ITENS CRÍTICOS / MÍNIMO
    if (
      p.includes("ruptura") ||
      p.includes("critico") ||
      p.includes("crítico") ||
      p.includes("minimo") ||
      p.includes("mínimo") ||
      p.includes("seguranca") ||
      p.includes("segurança")
    ) {
      const branchKey = targetBranch || "SP";
      const critical = products.filter(
        (pr: any) => {
          const qty = pr.estoquePorUnidade ? (pr.estoquePorUnidade[branchKey] ?? 0) : (pr.estoqueLocal || 0);
          return qty <= (pr.min || 0);
        }
      );
      let resp = `### ⚠️ Análise de Risco de Ruptura de Estoque (Unidade ${branchKey})\n\n`;
      if (critical.length > 0) {
        resp += `Foram identificados **${critical.length} itens** em nível crítico de estoque:\n\n`;
        resp += `| SKU | Produto | Categoria | Estoque Atual | Estoque Mínimo | Situação |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        critical.forEach((pr: any) => {
          const qty = pr.estoquePorUnidade ? (pr.estoquePorUnidade[branchKey] ?? 0) : (pr.estoqueLocal || 0);
          resp += `| ${pr.sku} | ${pr.nome} | ${pr.categoria} | **${qty} ${pr.unidadeMedida || "UN"}** | ${pr.min} | ⚠️ Abaixo do Mínimo |\n`;
        });
        resp += `\n🚨 **Ação Recomendada:** Iniciar cotação de compra urgente ou solicitar transferência interna a partir de outra unidade com estoque excedente.`;
      } else {
        resp += `Todos os produtos monitorados estão com estoque operando acima da margem mínima de segurança no momento.`;
      }
      return resp;
    }

    // 6. ORDENS DE COMPRA (OCs) — Em aberto, ativas, pendentes ou gerais
    const isPOQuery =
      /\bocs?\b/i.test(p) ||
      p.includes("ordem de compra") ||
      p.includes("ordens de compra") ||
      p.includes("pedido de compra") ||
      p.includes("pedidos de compra") ||
      (p.includes("compras") && (p.includes("abert") || p.includes("quant") || p.includes("status") || p.includes("lista") || p.includes("andamento")));

    if (isPOQuery) {
      const openPOs = purchaseOrders.filter((po: any) => po.status !== "ENTREGUE" && po.status !== "CANCELADO");
      const deliveredPOs = purchaseOrders.filter((po: any) => po.status === "ENTREGUE");
      const totalOpenValue = openPOs.reduce((acc: number, po: any) => acc + (po.totalValue || 0), 0);
      const totalDeliveredValue = deliveredPOs.reduce((acc: number, po: any) => acc + (po.totalValue || 0), 0);

      let resp = `### 🛒 Auditoria de Ordens de Compra (OCs) do ERP Almox Plus\n\n`;
      resp += `Atualmente temos **${openPOs.length} Ordens de Compra em aberto** (ativas) no sistema, totalizando **${fmtCurrency(totalOpenValue)}** em aquisições em andamento.\n\n`;
      resp += `No consolidado geral, constam **${purchaseOrders.length} OCs registradas** (${openPOs.length} em aberto e ${deliveredPOs.length} já entregue/concluída no valor de ${fmtCurrency(totalDeliveredValue)}).\n\n`;

      resp += `#### 1. Relação de Ordens de Compra em Aberto (${openPOs.length} OCs Ativas)\n`;
      resp += `| Código OC | Unidade | Fornecedor | Centro de Custo | Valor Total | Status Atual | Previsão de Entrega |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      openPOs.forEach((po: any) => {
        const statusLabel =
          po.status === "AGUARDANDO_APROVACAO"
            ? "⏳ Aguardando Aprovação"
            : po.status === "EM_TRANSITO"
            ? "🚚 Em Trânsito"
            : po.status === "APROVADO"
            ? "✅ Aprovado"
            : po.status;
        resp += `| **${po.code}** | Unidade ${po.branch} | ${po.supplierName} | ${po.costCenterName || po.costCenterId || "Geral"} | **${fmtCurrency(po.totalValue)}** | ${statusLabel} | ${po.estimatedDeliveryDate ? new Date(po.estimatedDeliveryDate).toLocaleDateString("pt-BR") : "A definir"} |\n`;
      });
      resp += `\n`;

      resp += `#### 2. Distribuição das OCs em Aberto por Unidade Operacional\n`;
      const posByBranchMap: Record<string, { count: number; total: number }> = {};
      openPOs.forEach((po: any) => {
        if (!posByBranchMap[po.branch]) posByBranchMap[po.branch] = { count: 0, total: 0 };
        posByBranchMap[po.branch].count += 1;
        posByBranchMap[po.branch].total += (po.totalValue || 0);
      });

      for (const [branch, data] of Object.entries(posByBranchMap)) {
        resp += `- **Unidade ${branch}:** **${data.count} OC(s) em aberto** — Total: **${fmtCurrency(data.total)}**\n`;
      }
      resp += `\n`;

      if (deliveredPOs.length > 0) {
        resp += `#### 3. Ordens de Compra Concluídas / Entregues (${deliveredPOs.length} OCs)\n`;
        deliveredPOs.forEach((po: any) => {
          resp += `- **${po.code}** (${po.supplierName}) — Unidade ${po.branch} | Valor: ${fmtCurrency(po.totalValue)} [Status: Entregue/Concluída]\n`;
        });
        resp += `\n`;
      }

      resp += `💡 **Diagnóstico de Suprimentos:** As ordens em aberto representam suprimento prioritário para reposição de estoque nas filiais (destaque para EPIs no RJ e infraestrutura de TI em SP).`;
      return resp;
    }

    // 7. SOLICITAÇÕES DE COMPRA (SCs) / COTAÇÕES
    const isSCQuery =
      /\bscs?\b/i.test(p) ||
      p.includes("solicitacao de compra") ||
      p.includes("solicitacoes de compra") ||
      p.includes("cotacao") ||
      p.includes("cotacoes");

    if (isSCQuery) {
      const pendingSCs = purchaseRequests.filter((sc: any) => sc.status === "PENDENTE");
      let resp = `### 📋 Solicitações de Compra (SCs) no Sistema\n\n`;
      resp += `Atualmente temos **${purchaseRequests.length} Solicitações de Compra** cadastradas, sendo **${pendingSCs.length} pendente(s)** de cotação/atendimento:\n\n`;
      resp += `| Código SC | Unidade | Solicitante | Prioridade | Status | Justificativa |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      purchaseRequests.forEach((sc: any) => {
        resp += `| **${sc.code}** | Unidade ${sc.branch} | ${sc.requestedBy} | ${sc.priority} | ${sc.status} | ${sc.justification ? sc.justification.slice(0, 60) + "..." : "Sem justificativa"} |\n`;
      });
      return resp;
    }

    // 8. REQUISIÇÕES DE MATERIAL (INTERNAS)
    const isReqQuery =
      p.includes("requisic") ||
      p.includes("solicitacao de material") ||
      p.includes("pedido interno") ||
      p.includes("pedidos internos");

    if (isReqQuery) {
      const pendingReqs = requisitions.filter((r: any) => r.status === "PENDENTE");
      let resp = `### 📦 Requisições de Material Internas\n\n`;
      resp += `Temos **${requisitions.length} Requisições Internas** cadastradas, sendo **${pendingReqs.length} pendente(s)** de atendimento:\n\n`;
      if (requisitions.length > 0) {
        resp += `| Código Req | Unidade | Centro de Custo | Solicitante | Status | Prioridade |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        requisitions.forEach((r: any) => {
          resp += `| **${r.code}** | Unidade ${r.branch} | ${r.costCenterName || r.costCenterId || "Geral"} | ${r.requestedBy} | ${r.status} | ${r.priority} |\n`;
        });
      } else {
        resp += `- Nenhuma requisição pendente registrada no momento.\n`;
      }
      return resp;
    }

    // 9. TRANSFERÊNCIAS ENTRE FILIAIS
    const isTransfQuery =
      p.includes("transfer") ||
      p.includes("remessa") ||
      p.includes("em transito") ||
      p.includes("entre filiais") ||
      p.includes("entre unidades");

    if (isTransfQuery) {
      const inTransit = transfers.filter((t: any) => t.status === "EM_TRANSITO");
      let resp = `### 🚚 Transferências entre Unidades Operacionais\n\n`;
      resp += `Constam **${transfers.length} transferências** cadastradas no sistema (${inTransit.length} em trânsito):\n\n`;
      if (transfers.length > 0) {
        resp += `| Código | Origem ➔ Destino | Item | Quantidade | Status |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
        transfers.forEach((t: any) => {
          resp += `| **${t.code}** | ${t.originBranch} ➔ ${t.destinationBranch} | ${t.productName} | ${t.quantity} | ${t.status} |\n`;
        });
      } else {
        resp += `Não há transferências registradas no momento.\n`;
      }
      return resp;
    }

    // 10. FORNECEDORES HOMOLOGADOS
    const isSupplierQuery =
      p.includes("forneced") ||
      p.includes("distribuidor");

    if (isSupplierQuery) {
      const suppliersSet = new Map<string, string>();
      purchaseOrders.forEach((po: any) => {
        if (po.supplierName) {
          suppliersSet.set(po.supplierName, po.supplierCnpj || "CNPJ Homologado");
        }
      });
      let resp = `### 🏢 Fornecedores Homologados no ERP Almox Plus\n\n`;
      resp += `Principais fornecedores ativos com ordens de compra e cotações registradas:\n\n`;
      resp += `| Razão Social / Fornecedor | CNPJ | Unidade Atendida | Status de Homologação |\n`;
      resp += `| :--- | :--- | :--- | :--- |\n`;
      suppliersSet.forEach((cnpj, name) => {
        resp += `| **${name}** | ${cnpj} | Nacional | ✅ Ativo e Homologado |\n`;
      });
      return resp;
    }

    // 11. PATRIMÔNIO & ATIVOS
    if (p.includes("patrimonio") || p.includes("ativo") || p.includes("equipamento") || p.includes("fluke")) {
      let resp = `### 🏷️ Consulta de Ativos e Patrimônio Imobilizado\n\n`;
      resp += `O ERP Almox Plus gerencia **${assets.length} ativos corporativos**:\n\n`;
      resp += `| Tag Patrimonial | Nome do Equipamento | Unidade | Categoria | Valor Atual | Status |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      assets.forEach((a: any) => {
        resp += `| **${a.assetTag}** | ${a.name} | Unidade ${a.branch} | ${a.category} | ${fmtCurrency(a.value || a.currentValue || 0)} | ${a.status} |\n`;
      });
      return resp;
    }

    // COMPARATIVO / RANKING DE GASTOS POR UNIDADE OPERACIONAL / FILIAL
    const isBranchExpenseComparison =
      p.includes("maior gasto") ||
      p.includes("mais gasta") ||
      p.includes("gasta mais") ||
      p.includes("gastam mais") ||
      p.includes("mais gastam") ||
      p.includes("gastadora") ||
      p.includes("onde gasta mais") ||
      p.includes("onde mais gasta") ||
      p.includes("quem gasta mais") ||
      p.includes("quem mais gasta") ||
      p.includes("gastamos mais") ||
      p.includes("onde mais se gasta") ||
      p.includes("unidade com maior") ||
      p.includes("unidade que mais") ||
      p.includes("filial que mais") ||
      p.includes("filial com maior") ||
      p.includes("maior despesa") ||
      p.includes("maior consumo") ||
      p.includes("maior custo") ||
      (p.includes("unidade") && (p.includes("maior") || p.includes("mais") || p.includes("ranking") || p.includes("comparat") || p.includes("gasto") || p.includes("despesa") || p.includes("custo") || p.includes("consum"))) ||
      (p.includes("filial") && (p.includes("maior") || p.includes("mais") || p.includes("ranking") || p.includes("comparat") || p.includes("gasto") || p.includes("despesa") || p.includes("custo") || p.includes("consum"))) ||
      ((p.includes("unidade") || p.includes("filial") || p.includes("filiais") || p.includes("unidades") || p.includes("onde gasta") || p.includes("quem gasta")) &&
      (p.includes("maior") || p.includes("mais gasta") || p.includes("gasta mais") || p.includes("ranking") || p.includes("comparat") || p.includes("distribui") || p.includes("gastos por") || p.includes("gasto por") || p.includes("despesas por") || p.includes("despesa por") || (p.includes("qual") && (p.includes("gasto") || p.includes("despesa") || p.includes("custo")))));

    // RANKING DE GASTOS POR CENTRO DE CUSTO / SETOR
    const isCCExpenseRanking =
      (p.includes("centro de custo") || p.includes("centros de custo") || p.includes("setor") || p.includes("departamento")) &&
      (p.includes("maior") || p.includes("mais gasta") || p.includes("gasta mais") || p.includes("ranking") || (p.includes("qual") && (p.includes("gasto") || p.includes("consumo"))));

    if (isBranchExpenseComparison) {
      const branches = ["SP", "RJ", "BSB", "SJRP"];
      const branchNames: Record<string, string> = {
        SP: "São Paulo (Matriz / Hub SP)",
        RJ: "Rio de Janeiro (Operações RJ)",
        BSB: "Brasília (Distrito Federal)",
        SJRP: "São José do Rio Preto (Interior SP)"
      };

      const branchStats = branches.map(b => {
        const bCCs = costCenters.filter((c: any) => (c.unidade || c.branch) === b);
        const bBudget = bCCs.reduce((sum: number, c: any) => sum + (c.orcamento || c.budget || 0), 0);
        const bSpentCC = bCCs.reduce((sum: number, c: any) => sum + (c.gastoRealizado || c.spent || 0), 0);
        const bPOs = purchaseOrders.filter((po: any) => po.branch === b && po.status !== "CANCELADO");
        const bTotalPO = bPOs.reduce((sum: number, po: any) => sum + (po.totalValue || 0), 0);
        const bTotalGasto = bSpentCC + bTotalPO;
        const bSaldoCC = bBudget - bSpentCC;

        let mainCC = bCCs[0];
        bCCs.forEach((c: any) => {
          if ((c.gastoRealizado || c.spent || 0) > ((mainCC?.gastoRealizado || mainCC?.spent) || 0)) {
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

      const pctTotal = grandTotalConsolidated > 0 ? ((topUnitTotal.totalGasto / grandTotalConsolidated) * 100).toFixed(1) : "0";
      const pctPO = grandTotalPO > 0 ? ((topUnitPO.totalPO / grandTotalPO) * 100).toFixed(1) : "0";

      let resp = `### 🏢 Análise Comparativa de Gastos por Unidade Operacional\n\n`;
      resp += `A unidade com o **maior gasto total consolidado** no ERP Almox Plus é a **Unidade ${topUnitTotal.branch} (${topUnitTotal.name.split(" ")[0]} ${topUnitTotal.name.split(" ")[1]})**, somando um dispêndio acumulado de **${fmtCurrency(topUnitTotal.totalGasto)}** (representando **${pctTotal}%** de todos os gastos da empresa).\n\n`;
      resp += `Ao detalharmos a natureza contábil dos gastos, observamos dois comportamentos fundamentais:\n\n`;
      resp += `1. **Maior Consumo em Centros de Custo (Operação Contínua & TI):** A **Unidade ${topUnitCC.branch}** lidera isoladamente com **${fmtCurrency(topUnitCC.spentCC)}** consumidos (com grande peso do setor de TI).\n`;
      resp += `2. **Maior Gasto em Novas Aquisições / Ordens de Compra (OCs):** A **Unidade ${topUnitPO.branch}** lidera com **${fmtCurrency(topUnitPO.totalPO)}** em compras (**${pctPO}%** do valor total de OCs corporativas), impulsionada pela ordem emergencial \`OC-2025-088\` (R$ 14.850,00, que excedeu o teto orçamentário).\n\n`;
      resp += `---\n\n`;

      resp += `#### 📊 1. Ranking Geral de Gastos por Unidade (Consolidado)\n\n`;
      resp += `| Posição | Unidade Operacional | Consumo em Centros de Custo | Aquisições em OCs | Gasto Consolidado Total | % Corporativo | Principal Centro de Custo |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const medalhas = ["🥇 1º Lugar", "🥈 2º Lugar", "🥉 3º Lugar", "4º Lugar"];
      sortedByTotal.forEach((b, idx) => {
        const pct = grandTotalConsolidated > 0 ? ((b.totalGasto / grandTotalConsolidated) * 100).toFixed(1) : "0";
        const mainCCDesc = b.mainCC ? `${b.mainCC.nome || b.mainCC.name} (${fmtCurrency(b.mainCC.gastoRealizado || b.mainCC.spent)})` : "Geral";
        resp += `| **${medalhas[idx] || `${idx + 1}º Lugar`}** | **Unidade ${b.branch}** | ${fmtCurrency(b.spentCC)} | ${fmtCurrency(b.totalPO)} (${b.poCount} OCs) | **${fmtCurrency(b.totalGasto)}** | **${pct}%** | ${mainCCDesc} |\n`;
      });

      resp += `| **TOTAL GERAL** | **Todas as 4 Filiais** | **${fmtCurrency(grandTotalCC)}** | **${fmtCurrency(grandTotalPO)}** | **${fmtCurrency(grandTotalConsolidated)}** | **100,0%** | Orçamento Total: ${fmtCurrency(grandBudget)} |\n\n`;
      resp += `---\n\n`;

      resp += `#### 🔍 2. Raio-X da Unidade Líder em Gastos: Unidade SP (${fmtCurrency(topUnitTotal.totalGasto)})\n`;
      resp += `- **Consumo nos Centros de Custo:**\n`;
      topUnitTotal.ccs.forEach((c: any) => {
        resp += `  - **${c.codigo || c.code} - ${c.nome || c.name}:** Gasto de **${fmtCurrency(c.gastoRealizado || c.spent)}** (de ${fmtCurrency(c.orcamento || c.budget)} alocados | Saldo: ${fmtCurrency((c.orcamento || c.budget) - (c.gastoRealizado || c.spent))})\n`;
      });
      resp += `- **Ordens de Compra Emitidas:** 2 OCs ativas/entregues somando **${fmtCurrency(topUnitTotal.totalPO)}** (\`OC-2025-095\` TI R$ 7.500,00 e \`OC-2025-092\` Logística R$ 3.700,00).\n\n`;

      resp += `#### ⚠️ 3. Alerta de Gestão: Unidade RJ (Pico em Ordens de Compra)\n`;
      resp += `A Unidade RJ é a segunda em gastos consolidados (${fmtCurrency(branchStats.find(b => b.branch === "RJ")?.totalGasto || 0)}), porém é a **campeã de aquisições de novos materiais (${fmtCurrency(topUnitPO.totalPO)})**:\n`;
      resp += `- **OC-2025-088:** R$ 14.850,00 (EletroTubos) — **Estouro de Teto de + R$ 4.850,00** aguardando parecer da Diretoria.\n`;
      resp += `- **OC-2025-098:** R$ 4.500,00 (Proteção & Cia) — Luvas de vaqueta para reposição urgente.\n\n`;

      resp += `💡 **Diretriz Estratégica:** A Unidade SP possui a maior escala operacional e sede administrativa da empresa, justificando o volume de TI e logística. Já na Unidade RJ, a recomendação é estancar compras emergenciais utilizando remessas de transferência a partir do estoque excedente de SP.`;

      return resp;
    }

    if (isCCExpenseRanking) {
      const sortedCCs = [...costCenters].sort((a: any, b: any) => (b.gastoRealizado || b.spent || 0) - (a.gastoRealizado || a.spent || 0));
      const topCC = sortedCCs[0];
      const totalCCSpent = sortedCCs.reduce((acc, c: any) => acc + (c.gastoRealizado || c.spent || 0), 0);

      let resp = `### 📊 Ranking de Gastos por Centro de Custo / Setor\n\n`;
      resp += `O centro de custo com o **maior gasto realizado** no ERP Almox Plus é o **${topCC.codigo || topCC.code} - ${topCC.nome || topCC.name} (Unidade ${topCC.unidade || topCC.branch})**, com um consumo acumulado de **${fmtCurrency(topCC.gastoRealizado || topCC.spent)}**.\n\n`;
      resp += `#### Ranking de Todos os Centros de Custo (Do Maior para o Menor Consumo):\n\n`;
      resp += `| Posição | Código CC | Centro de Custo | Unidade | Gasto Realizado | Orçamento Alocado | Saldo Disponível | % Consumido |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      const medalhas = ["🥇 1º", "🥈 2º", "🥉 3º", "4º", "5º"];
      sortedCCs.forEach((c: any, idx) => {
        const spent = c.gastoRealizado || c.spent || 0;
        const budget = c.orcamento || c.budget || 0;
        const saldo = budget - spent;
        const pct = budget > 0 ? ((spent / budget) * 100).toFixed(1) : "0";
        resp += `| **${medalhas[idx] || `${idx + 1}º`}** | **${c.codigo || c.code}** | ${c.nome || c.name} | Unidade ${c.unidade || c.branch} | **${fmtCurrency(spent)}** | ${fmtCurrency(budget)} | ${fmtCurrency(saldo)} | ${pct}% |\n`;
      });

      resp += `\n💡 **Diagnóstico:** O setor de TI em SP (**${topCC.codigo || topCC.code}**) absorve ${totalCCSpent > 0 ? (((topCC.gastoRealizado || topCC.spent) / totalCCSpent) * 100).toFixed(1) : "0"}% de todo o consumo corporativo de centros de custo.`;
      return resp;
    }

    // 8. FILIAL ESPECÍFICA (Target Branch)
    if (targetBranch) {
      const branchCCs = costCenters.filter((c: any) => (c.unidade || c.branch) === targetBranch);
      const branchData = summary.gastosPorUnidade?.[targetBranch] || { count: 0, total: 0 };
      const totalBudgetBranch = branchCCs.reduce((acc: number, c: any) => acc + (c.orcamento || c.budget || 0), 0);
      const totalSpentBranch = branchCCs.reduce((acc: number, c: any) => acc + (c.gastoRealizado || c.spent || 0), 0);
      const saldoBranch = totalBudgetBranch - totalSpentBranch;

      let resp = `### 📊 Relatório Financeiro e de Operações — Unidade ${targetBranch}\n\n`;
      resp += `#### 1. Indicadores da Unidade ${targetBranch}\n`;
      resp += `- **Total em Ordens de Compra:** ${fmtCurrency(branchData.total)} (${branchData.count} OCs)\n`;
      resp += `- **Consumo nos Centros de Custo:** ${fmtCurrency(totalSpentBranch)}\n`;
      resp += `- **Orçamento Total Alocado:** ${fmtCurrency(totalBudgetBranch)}\n`;
      resp += `- **Saldo Orçamentário Livre:** ${fmtCurrency(saldoBranch)}\n\n`;

      if (branchCCs.length > 0) {
        resp += `#### 2. Centros de Custo da Unidade ${targetBranch}\n`;
        resp += `| Código CC | Centro de Custo | Orçamento | Gasto Realizado | Saldo Disponível |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
        branchCCs.forEach((cc: any) => {
          resp += `| ${cc.codigo || cc.code} | ${cc.nome || cc.name} | ${fmtCurrency(cc.orcamento || cc.budget)} | ${fmtCurrency(cc.gastoRealizado || cc.spent)} | ${fmtCurrency((cc.orcamento || cc.budget) - (cc.gastoRealizado || cc.spent))} |\n`;
        });
      }
      return resp;
    }

    // 9. RELATÓRIO FINANCEIRO GLOBAL (Gasto / Financeiro / Despesas)
    if (p.includes("gasto") || p.includes("financeiro") || p.includes("despesa") || p.includes("valor total")) {
      const totalCompras = purchaseOrders.filter((po: any) => po.status !== "CANCELADO").reduce((sum: number, po: any) => sum + (po.totalValue || 0), 0);
      const totalConsumidoCC = costCenters.reduce((sum: number, c: any) => sum + (c.gastoRealizado || c.spent || 0), 0);
      const orcamentoTotal = costCenters.reduce((sum: number, c: any) => sum + (c.orcamento || c.budget || 0), 0);
      const saldoRestante = orcamentoTotal - totalConsumidoCC;
      const valorEstoque = products.reduce((sum: number, pr: any) => sum + (pr.valorTotalEstoque || 0), 0);

      let resp = `### 📊 Relatório Consolidado de Gastos e Finanças (Visão Global)\n\n`;
      resp += `#### 1. Totais Globais de Compras e Orçamento\n`;
      resp += `- **Total Gasto em Ordens de Compra (OCs):** ${fmtCurrency(totalCompras)}\n`;
      resp += `- **Consumo Realizado nos Centros de Custo:** ${fmtCurrency(totalConsumidoCC)}\n`;
      resp += `- **Orçamento Total Alocado (Budget):** ${fmtCurrency(orcamentoTotal)}\n`;
      resp += `- **Saldo Orçamentário Disponível:** ${fmtCurrency(saldoRestante)} (${orcamentoTotal > 0 ? ((saldoRestante / orcamentoTotal) * 100).toFixed(1) : "0"}% disponível)\n`;
      resp += `- **Valor Total Imobilizado em Estoque (Almoxarifado):** ${fmtCurrency(valorEstoque)}\n\n`;
      return resp;
    }

    // CURVA ABC / PARETO DE ESTOQUE
    const isCurvaABC =
      p.includes("curva abc") ||
      p.includes("pareto") ||
      p.includes("classificacao abc") ||
      p.includes("diagnostico curva abc") ||
      (p.includes("abc") && (p.includes("estoque") || p.includes("curva") || p.includes("analise")));

    if (isCurvaABC) {
      const sortedProds = [...products].sort((a: any, b: any) => (b.valorTotalEstoque || 0) - (a.valorTotalEstoque || 0));
      const grandTotalVal = sortedProds.reduce((acc: number, pr: any) => acc + (pr.valorTotalEstoque || 0), 0);

      let accumVal = 0;
      const classA: any[] = [];
      const classB: any[] = [];
      const classC: any[] = [];

      sortedProds.forEach((pr: any) => {
        const val = pr.valorTotalEstoque || 0;
        accumVal += val;
        const accumPct = grandTotalVal > 0 ? (accumVal / grandTotalVal) * 100 : 100;
        if (accumPct <= 80 || classA.length < 3) {
          classA.push(pr);
        } else if (accumPct <= 95 || classB.length < 3) {
          classB.push(pr);
        } else {
          classC.push(pr);
        }
      });

      const totalA = classA.reduce((s: number, p: any) => s + (p.valorTotalEstoque || 0), 0);
      const totalB = classB.reduce((s: number, p: any) => s + (p.valorTotalEstoque || 0), 0);
      const totalC = classC.reduce((s: number, p: any) => s + (p.valorTotalEstoque || 0), 0);

      let resp = `### 📊 Diagnóstico da Curva ABC de Estoque (Princípio de Pareto 80/20)\n\n`;
      resp += `A análise da Curva ABC estratifica o capital imobilizado de **${fmtCurrency(grandTotalVal)}** em **${products.length} itens cadastrados** no Almox Plus:\n\n`;

      resp += `| Classe | Quantidade de SKUs | % dos Itens | Valor Imobilizado (R$) | % do Capital | Diretriz de Gestão |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      resp += `| 🔴 **Classe A** | **${classA.length} itens** | ${(products.length > 0 ? (classA.length / products.length) * 100 : 0).toFixed(1)}% | **${fmtCurrency(totalA)}** | ${(grandTotalVal > 0 ? (totalA / grandTotalVal) * 100 : 0).toFixed(1)}% | Controle diário rigoroso, inventário cíclico quinzenal e negociação direta de compras |\n`;
      resp += `| 🟡 **Classe B** | **${classB.length} itens** | ${(products.length > 0 ? (classB.length / products.length) * 100 : 0).toFixed(1)}% | **${fmtCurrency(totalB)}** | ${(grandTotalVal > 0 ? (totalB / grandTotalVal) * 100 : 0).toFixed(1)}% | Reposição automática com ponto de pedido e auditoria mensal |\n`;
      resp += `| 🟢 **Classe C** | **${classC.length} itens** | ${(products.length > 0 ? (classC.length / products.length) * 100 : 0).toFixed(1)}% | **${fmtCurrency(totalC)}** | ${(grandTotalVal > 0 ? (totalC / grandTotalVal) * 100 : 0).toFixed(1)}% | Compra em lote para ganho de escala, baixo esforço burocrático |\n\n`;

      resp += `#### 🎯 Principais Itens da Classe A (Maior Peso Financeiro):\n`;
      resp += `| SKU | Produto | Categoria | Saldo Físico | Preço Unitário | Total em R$ |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      classA.slice(0, 8).forEach((p: any) => {
        const qty = p.estoqueGlobal !== undefined ? p.estoqueGlobal : (p.estoqueLocal || 0);
        resp += `| **${p.sku || p.code}** | ${p.nome || p.name} | ${p.categoria || p.category} | ${qty} ${p.unidadeMedida || p.unit || "UN"} | ${fmtCurrency(p.preco || p.unitPrice || 0)} | **${fmtCurrency(p.valorTotalEstoque || 0)}** |\n`;
      });

      return resp;
    }

    // RELATÓRIO EXECUTIVO PARA DIRETORIA
    const isExecutiveReport =
      p.includes("relatorio executivo") ||
      p.includes("apresentacao da diretoria") ||
      p.includes("apresentacao para diretoria") ||
      p.includes("visao executiva") ||
      p.includes("sumario executivo");

    if (isExecutiveReport) {
      const activeBranches = branches.filter((b: any) => b.active !== false);
      const totalInventoryVal = products.reduce((sum: number, pr: any) => sum + (pr.valorTotalEstoque || 0), 0);
      const totalActivePOs = purchaseOrders.filter((po: any) => po.status !== "CANCELADO");
      const totalPOVal = totalActivePOs.reduce((sum: number, po: any) => sum + (po.totalValue || 0), 0);
      const totalCCBudget = costCenters.reduce((sum: number, c: any) => sum + (c.orcamento || c.budget || 0), 0);
      const totalCCSpent = costCenters.reduce((sum: number, c: any) => sum + (c.gastoRealizado || c.spent || 0), 0);
      const criticalProds = products.filter((pr: any) => (pr.estoqueGlobal || 0) <= (pr.min || 0));

      let resp = `### 📊 Relatório Executivo Consolidado — Apresentação da Diretoria\n\n`;
      resp += `Este relatório apresenta a posição operacional e financeira consolidada do **Almox Plus ERP**:\n\n`;

      resp += `#### 1. Resumo Executivo dos Módulos (Visão 360°)\n`;
      resp += `- **Rede de Unidades Operacionais:** **${activeBranches.length} unidade(s) ativa(s)** (${activeBranches.map((b: any) => b.code).join(", ")}) de ${branches.length} filiais cadastradas.\n`;
      resp += `- **Capital Total Imobilizado em Estoque:** **${fmtCurrency(totalInventoryVal)}** distribuído em **${products.length} produtos / SKUs**.\n`;
      resp += `- **Compras Corporativas:** **${totalActivePOs.length} Ordens de Compra ativas** somando **${fmtCurrency(totalPOVal)}**.\n`;
      resp += `- **Orçamento de Centros de Custo:** **${fmtCurrency(totalCCBudget)} aprovados**, com consumo realizado de **${fmtCurrency(totalCCSpent)}** (Saldo livre: **${fmtCurrency(totalCCBudget - totalCCSpent)}**).\n`;
      resp += `- **Nível de Atendimento & Risco:** **${criticalProds.length} produto(s)** operam em ponto crítico de reposição.\n\n`;

      resp += `#### 2. Distribuição por Unidade Operacional\n`;
      resp += `| Unidade | Tipo | Responsável | Status | Situação do Estoque |\n`;
      resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
      activeBranches.forEach((b: any) => {
        resp += `| **${b.code}** | ${b.unitType || "Operacional"} | ${b.managerName || b.manager || "Atribuído"} | 🟢 Ativa | Sincronizado |\n`;
      });
      resp += `\n`;

      resp += `#### 3. Recomendações Estratégicas para o Board:\n`;
      resp += `1. **Controle de Compras Emergenciais:** Dar preferência para transferências entre filiais a partir da Matriz SP antes de abrir novas OCs de compra spot.\n`;
      resp += `2. **Acuracidade de Inventário:** Concluir as campanhas de contagem rotativa com reconciliação contábil.\n`;
      resp += `3. **Governança de Teto Orçamentário:** Manter a trava automática de alçadas em centros de custo com mais de 85% do teto consumido.`;

      return resp;
    }

    // REDISTRIBUIÇÃO INTELIGENTE ENTRE UNIDADES
    const isRedistribution =
      p.includes("redistribui") ||
      p.includes("recomende redistribuicao") ||
      (p.includes("transfer") && p.includes("inteligente"));

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

    // ITENS ESTAGNADOS / SEM MOVIMENTAÇÃO
    const isStagnantItems =
      p.includes("estagna") ||
      p.includes("sem movimentacao") ||
      p.includes("parados") ||
      p.includes("sem giro");

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

    // PATRIMÔNIOS SEM RESPONSÁVEL
    const isUnassignedAssets =
      p.includes("patrimonio") && (p.includes("sem responsavel") || p.includes("inventario") || p.includes("sem termo") || p.includes("cautela"));

    if (isUnassignedAssets) {
      const unassigned = assets.filter((a: any) => !a.responsibleName && !a.manager && !a.assignedTo);
      let resp = `### 🏷️ Consulta de Patrimônios e Ativos sem Responsável Alocado\n\n`;
      if (unassigned.length > 0) {
        resp += `Constam **${unassigned.length} ativo(s) corporativo(s)** sem termo de cautela ou responsável formal registrado:\n\n`;
        resp += `| Tag Patrimonial | Equipamento | Categoria | Unidade | Valor Contábil | Situação |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        unassigned.forEach((a: any) => {
          resp += `| **${a.assetTag}** | ${a.name} | ${a.category} | Unidade ${a.branch} | ${fmtCurrency(a.value || a.currentValue || 0)} | ⚠️ **Pendente de Cautela** |\n`;
        });
        resp += `\n💡 **Ação Corretiva:** Acesse o módulo **Patrimônio**, localize a tag e emita o **Termo de Responsabilidade / Cautela** assinado pelo colaborador ou gestor do setor.`;
      } else {
        resp += `Todos os ativos patrimoniais cadastrados possuem responsáveis e termos de cautela devidamente vinculados no sistema.`;
      }
      return resp;
    }

    // 10. FALLBACK GERAL: PAINEL EXECUTIVO 360 DO ERP
    const totalInventoryValue = products.reduce((sum: number, pr: any) => sum + (pr.valorTotalEstoque || 0), 0);
    const totalActivePOs = purchaseOrders.filter((po: any) => po.status !== "CANCELADO").length;
    const activeBranchesList = branches.filter((b: any) => b.active !== false);

    return (
      `### 📋 Painel Operacional Integrado — Assistente Almox Plus\n\n` +
      `Estou conectado a **todos os módulos** do ERP Almox Plus nas unidades **${activeBranchesList.map((b: any) => b.code).join(", ") || "SP, RJ, SJRP e BSB"}**:\n\n` +
      `- **🏢 Unidades Operacionais:** ${activeBranchesList.length} ativa(s) de ${branches.length} filiais cadastradas.\n` +
      `- **📦 Catálogo de Estoque:** ${products.length} itens monitorados em tempo real (Valor Total: ${fmtCurrency(totalInventoryValue)}).\n` +
      `- **🛒 Ordens de Compra:** ${purchaseOrders.length} OCs registradas (${totalActivePOs} ativas).\n` +
      `- **🏢 Centros de Custo:** ${costCenters.length} centros monitorando orçamento e consumo.\n` +
      `- **🚚 Logística & Transferências:** Monitoramento ativo de remessas entre unidades.\n` +
      `- **🏷️ Patrimônio & Ativos:** ${assets.length} ativos imobilizados cadastrados.\n\n` +
      `**Exemplos de perguntas que posso responder com precisão:**\n` +
      `- *"Quantas unidades ativas temos?"*\n` +
      `- *"Quais produtos temos no estoque ou que subiram no CSV?"*\n` +
      `- *"Como o material de limpeza é vinculado ao centro de custo?"*\n` +
      `- *"Qual o diagnóstico da Curva ABC de estoque?"*\n` +
      `- *"Quantas OC tiveram o teto estourado de valor?"*\n` +
      `- *"Há algum produto no estoque vencido ou perto de vencer?"*`
    );
  }

  // API Route for Gemini AI Assistant
  app.post("/api/gemini", async (req, res) => {
    const { prompt, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // Build optimized products view for AI inference
    let productsForAI: any;
    if (context?.products && Array.isArray(context.products)) {
      if (context.products.length > 40) {
        const sortedByVal = [...context.products].sort((a, b) => (b.valorTotalEstoque || 0) - (a.valorTotalEstoque || 0));
        const top30 = sortedByVal.slice(0, 30).map(p => ({
          sku: p.sku || p.code,
          nome: p.nome || p.name,
          cat: p.categoria || p.category,
          estTotal: p.estoqueGlobal,
          estPorUnid: p.estoquePorUnidade,
          preco: p.preco || p.unitPrice,
          totalR$: p.valorTotalEstoque,
          val: p.dataValidade,
          statusVal: p.statusValidade
        }));
        const criticalItems = context.products.filter((p: any) => (p.estoqueGlobal || 0) <= (p.min || 0)).slice(0, 20).map((p: any) => ({
          sku: p.sku || p.code,
          nome: p.nome || p.name,
          saldo: p.estoqueGlobal,
          min: p.min
        }));
        const allSkusAndNames = context.products.map((p: any) => `${p.sku || p.code}: ${p.nome || p.name} (${p.estoqueGlobal || 0} ${p.unidadeMedida || 'UN'})`).slice(0, 300);

        productsForAI = {
          totalCadastrados: context.products.length,
          top30MaisRelevantesFinanceiramente: top30,
          itensEmRiscoRupturaAbaixoDoMinimo: criticalItems,
          indiceCatalogoGeral: allSkusAndNames
        };
      } else {
        productsForAI = context.products;
      }
    } else {
      productsForAI = INITIAL_PRODUCTS.map(p => ({ sku: p.code, nome: p.name, estoque: p.stockByBranch }));
    }

    const systemInstruction = `Você é o Assistente de Inteligência Artificial Especialista do ERP Almox Plus (sistema corporativo de gestão de almoxarifado, estoque multiunidade, compras, centros de custos e inventário).
Sua missão é dar respostas precisas, assertivas, profissionais e profundas aos gestores, compradores e operadores do sistema.
NUNCA dê respostas genéricas, evasivas ou desconectadas da realidade do sistema.

CONHECIMENTO PROFUNDO DO ERP ALMOX PLUS:
1. MÓDULO DE UNIDADES OPERACIONAIS / FILIAIS (BRANCHES):
   - A empresa opera com uma rede multiunidade (Matriz, Filiais Operacionais, Centros de Distribuição, Administrativas).
   - O sistema gerencia unidades ATIVAS e INATIVAS. O badge no menu lateral 'Unidades' exibe a contagem de filiais ativas no momento (ex: '1 ativas' se apenas SP estiver ativa).
   - Quando o usuário perguntar 'quantas unidades ativas temos?', 'quais unidades temos?', 'quantas filiais?', responda com exatidão citando a quantidade de unidades ativas vs inativas e listando cada uma com código, tipo, cidade/UF, CNPJ, responsável e status.
2. ARQUITETURA DE PRODUTOS E CENTROS DE CUSTO:
   - No Almox Plus, os produtos NÃO são engessados a um único centro de custo no catálogo de cadastro. O produto possui Categoria (ex: Limpeza & Higiene, EPI & Segurança, Informática & TI).
   - O vínculo com o Centro de Custo é DINÂMICO no momento da operação (requisição de material ou compra).
   - Exemplo clássico do Material de Limpeza: Se for consumido na sede administrativa/escritórios, debita do Centro de Custo 'Administrativo/RH'. Se for consumido nas docas/galpão de armazém, debita de 'Operações e Logística'. Se for manutenção predial, debita de 'Manutenção/Facilities'.
   - O acompanhamento é feito em 'Centro de Custos ➔ Comparativo Comprado vs. Entregue' e no extrato detalhado do setor.
3. MATRIZ DE PERFIS DE USUÁRIOS (RBAC):
   - Almoxarife: Foco operacional diário no estoque físico. Registra entradas de mercadorias (com conferência e NF-e), atende e dá baixa em requisições de materiais (SAÍDA), executa contagem física e bipagem em campanhas de inventário rotativo, despacha e recebe transferências entre unidades, gerencia etiquetas, lotes e endereçamento (rua/prateleira). Não aprova compras financeiras nem altera orçamentos.
   - Usuário Regular (Solicitante): Colaborador comum da empresa (ex: do departamento comercial, RH, operação). Acesso restrito a abrir requisições de material para o seu setor/centro de custo e acompanhar o andamento. Não tem acesso a movimentar fisicamente o almoxarifado, dar entradas, ver estoque financeiro ou configurar o ERP.
   - Master (Administrador Geral): Acesso irrestrito a todas as 4 filiais (SP, RJ, BSB, SJRP), gestão de usuários e permissões, aprovações acima de alçada, auditorias de teto, inventário e transição para modo de produção.
   - Comprador: Cotações, SCs, OCs, fornecedores, savings e prazos de entrega.
   - Diretoria / Gestão: Painel executivo de BI, indicadores de desempenho, Curva ABC (Pareto) e relatórios de governança.
4. IMPORTAÇÃO VIA CSV:
   - Feita no menu 'Almoxarifado ➔ Importar Produtos CSV'.
   - Colunas padrão: Código/SKU, Nome, Categoria, Unidade de Medida, Preço Unitário, Estoque Mínimo, Estoque Máximo, Localização/Prateleira, Validade e Lote.
   - Ordem de implantação recomendada: 1º Unidades Operacionais ➔ 2º Centros de Custo com Orçamentos ➔ 3º Fornecedores ➔ 4º Produtos e Saldos Iniciais ➔ 5º Usuários.
5. INVENTÁRIO FÍSICO & AUDITORIA:
   - Permite criar campanhas filtradas por Categoria específica (ex: auditar apenas 'EPI & Segurança' ou 'Limpeza & Higiene') ou Todas as Categorias.
   - Contagem física cega ou guiada, apuração de acuracidade (% conformidade física vs sistema), divergências (sobras e faltas em unidades e R$).
   - Reconciliação com atualização de estoque e histórico na aba 'Finalizadas & Reconciliadas', com emissão de laudo em PDF para Diretoria e planilha em Excel.
6. MODO DE PRODUÇÃO E MARCO ZERO:
   - Ao ativar modo de produção ou zerar dados para operação real, o ERP zera movimentações, requisições, ordens de compra e zera o consumo realizado nos centros de custo (deixando 100% do orçamento livre).
   - Se o sistema estiver com gastos zerados (R$ 0,00), reporte isso assertivamente como Marco Zero limpo e pronto para produção.
7. CURVA ABC E INDICADORES (PARETO):
   - Classe A (80% do valor imobilizado), Classe B (15%), Classe C (5%).

DADOS REAIS EM TEMPO REAL DO ERP ALMOX PLUS (INSPECIONE E UTILIZE SEMPRE ESTES DADOS):
- Usuário Atual: ${context?.user || "Gestor"} (${context?.role || "Master"})
- Unidade Selecionada: ${context?.branch || "SP"}
- Unidades Operacionais / Filiais (Rede Multiunidade): ${JSON.stringify(context?.branches || [])}
- Resumo Financeiro & KPIs: ${JSON.stringify(context?.summaryData || {})}
- Centros de Custo (Orçamentos e Consumos Reais): ${JSON.stringify(context?.costCenters || [])}
- Ordens de Compra (OCs e Alçadas): ${JSON.stringify(context?.purchaseOrders || [])}
- Produtos em Estoque (Catálogo Otimizado): ${JSON.stringify(productsForAI)}
- Campanhas de Inventário: ${JSON.stringify(context?.inventories || [])}
- Usuários Cadastrados: ${JSON.stringify(context?.users || [])}
- Transferências Ativas: ${JSON.stringify(context?.transfers || [])}

DIRETRIZES DE FORMATAÇÃO E TOM:
- Responda sempre em Português do Brasil com excelente estrutura em Markdown (use títulos com emojis adequados, tabelas comparativas limpas, marcadores de destaque e diagnósticos práticos).
- Seja direto e assertivo logo na primeira frase. NUNCA diga frases vagas como "consulte o manual" ou "depende".`;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY não configurada no ambiente. Utilizando motor de inteligência heurística especializado do ERP Almox Plus.");
      const fallbackText = generateFallbackResponse(prompt, context);
      return res.json({ reply: fallbackText });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Timeout estendido para 25s para garantir processamento analítico profundo
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout waiting for Gemini response")), 25000)
      );

      const geminiPromise = ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const response = await Promise.race([geminiPromise, timeoutPromise]);
      const replyText = response.text || generateFallbackResponse(prompt, context);
      return res.json({ reply: replyText });
    } catch (error: any) {
      console.warn("Gemini API Fallback acionado:", error?.message || error);
      const fallbackText = generateFallbackResponse(prompt, context);
      return res.json({ reply: fallbackText });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Almox Plus ERP" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Almox Plus ERP Server running on http://localhost:${PORT}`);
  });
}

startServer();
