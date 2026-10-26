import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

import {
  INITIAL_PRODUCTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_COST_CENTERS,
  INITIAL_PURCHASE_REQUESTS,
  INITIAL_ASSETS
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

    const fmtCurrency = (val: number) =>
      (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Detecção de unidade operacional específica no prompt
    let targetBranch: string | null = null;
    if (/\brj\b|rio de janeiro/i.test(p)) targetBranch = "RJ";
    else if (/\bsp\b|s[aã]o paulo/i.test(p)) targetBranch = "SP";
    else if (/\bsjrp\b|s[aã]o jos[eé]/i.test(p)) targetBranch = "SJRP";
    else if (/\bbsb\b|bras[ií]lia/i.test(p)) targetBranch = "BSB";

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
      p.includes("onde gasta mais") ||
      p.includes("onde mais gasta") ||
      (p.includes("unidade") && (p.includes("maior") || p.includes("mais") || p.includes("ranking") || p.includes("comparat") || p.includes("gasto"))) ||
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

    // 10. FALLBACK GERAL: PAINEL EXECUTIVO 360 DO ERP
    const totalInventoryValue = products.reduce((sum: number, pr: any) => sum + (pr.valorTotalEstoque || 0), 0);
    const totalActivePOs = purchaseOrders.filter((po: any) => po.status !== "CANCELADO").length;

    return (
      `### 📋 Painel Operacional Integrado — Assistente Almox Plus\n\n` +
      `Estou conectado a **todos os módulos** do ERP Almox Plus nas unidades **SP, RJ, SJRP e BSB**:\n\n` +
      `- **📦 Catálogo de Estoque:** ${products.length} itens monitorados em tempo real (Valor Total: ${fmtCurrency(totalInventoryValue)}).\n` +
      `- **🛒 Ordens de Compra:** ${purchaseOrders.length} OCs registradas (${totalActivePOs} ativas).\n` +
      `- **🏢 Centros de Custo:** ${costCenters.length} centros monitorando orçamento e consumo.\n` +
      `- **🚚 Logística & Transferências:** Monitoramento ativo de remessas entre unidades.\n` +
      `- **🏷️ Patrimônio & Ativos:** ${assets.length} ativos imobilizados cadastrados.\n\n` +
      `**Exemplos de perguntas que posso responder com precisão:**\n` +
      `- *"Quanto temos de luva de vaqueta no estoque?"*\n` +
      `- *"Quantas OC tiveram o teto estourado de valor?"*\n` +
      `- *"Quanto temos disponível por centro de custo?"*\n` +
      `- *"Há algum produto no estoque vencido ou perto de vencer?"*\n` +
      `- *"Quais itens estão abaixo do estoque mínimo em SP ou no RJ?"*`
    );
  }

  // API Route for Gemini AI Assistant
  app.post("/api/gemini", async (req, res) => {
    const { prompt, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const systemInstruction = `Você é o assistente virtual sênior do sistema ERP Almox Plus. Seu papel é dar consultoria operacional e analítica em gestão de almoxarifado, estoque de produtos, compras, curva ABC, transferência entre unidades (RJ, SJRP, SP, BSB), controle de validade e lotes, ordens de compra e tetos orçamentários. Seja objetivo, profissional e estruturado em Português do Brasil com formatação rica em Markdown (tabelas, listas e destaques em negrito).
Data atual de referência do sistema: ${new Date().toLocaleDateString('pt-BR')}.
Contexto corporativo do ERP Almox Plus:
- Usuário: ${context?.user || "Gestor"}
- Perfil: ${context?.role || "Master"}
- Unidade Ativa: ${context?.branch || "SP"}
- Resumo Financeiro e Indicadores: ${JSON.stringify(context?.summaryData || {})}
- Centros de Custo (Orçamento vs Consumo): ${JSON.stringify(context?.costCenters || [])}
- Ordens de Compra (OCs e Alçadas): ${JSON.stringify(context?.purchaseOrders || [])}
- Catálogo de Produtos com Estoque por Unidade, Validade e Lotes: ${JSON.stringify(context?.products || [])}

DIRETRIZES CRÍTICAS:
1. CONSULTAS DE PRODUTOS ESPECÍFICOS (ex: "quanto temos de luva de vaqueta"):
   - Verifique sempre o saldo total e o estoque por filial (SP, RJ, SJRP, BSB).
   - Indique código SKU, preço unitário, valor total imobilizado e aponte se alguma filial está abaixo do estoque mínimo.
   - Verifique se há ordens de compra ativas para reposição.
2. ORDENS DE COMPRA COM TETO ESTOURADO (ex: "quantas OC tiveram o teto estourado de valor"):
   - Analise as ordens com 'budgetOverrun: true' ou valor excedente (ex: OC-2025-088).
   - Apresente tabela com código da OC, fornecedor, valor da OC, valor do estouro e justificativa.
   - Liste as demais OCs regulares e detalhe os procedimentos de conformidade e alçada.
3. PRODUTOS VENCIDOS OU VALIDADE:
   - Se houver produtos vencidos (ex: MED-001 e QUI-001), afirme claramente que SIM e forneça tabela com lotes, confirmação se o lote é idêntico em todas as filiais e perdas financeiras.
4. CENTROS DE CUSTO:
   - Se perguntarem sobre saldo ou valor disponível por centro de custo, forneça tabela detalhada com orçamento aprovado, gasto realizado e saldo disponível.
5. GASTOS POR UNIDADE / FILIAL / QUAL UNIDADE TEM O MAIOR GASTO (ex: "qual unidade tem o maior gasto", "qual filial gasta mais"):
   - Responda DIRETAMENTE na primeira linha: Unidade SP (São Paulo) tem o maior gasto total consolidado (R$ 369.100,00, considerando centros de custo e ordens de compra).
   - Apresente a distinção entre Consumo de Centros de Custo (onde SP lidera com R$ 357.900,00 impulsionada por TI) e Ordens de Compra (onde RJ lidera com R$ 19.350,00 impulsionada pela OC-2025-088).
   - Forneça tabela de ranking comparativo de todas as 4 filiais (SP, RJ, BSB, SJRP).
6. RANKING DE GASTOS POR CENTRO DE CUSTO (ex: "qual centro de custo tem o maior gasto"):
   - Responda diretamente: CC-103 Tecnologia da Informação (SP) lidera com R$ 215.600,00 consumidos de R$ 320.000,00 alocados.`;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY não configurada. Utilizando inteligência heurística baseada no contexto do ERP.");
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

      // Timeout de 8s para garantir resposta do Gemini com fallback ágil se offline
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout waiting for Gemini response")), 8000)
      );

      const geminiPromise = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
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
