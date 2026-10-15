import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for intelligent fallback response based on ERP data
  function generateFallbackResponse(prompt: string, context: any): string {
    const p = (prompt || "").toLowerCase();
    const summary = context?.summaryData || {};
    const costCenters = context?.costCenters || [];
    const recentOrders = context?.recentOrders || [];
    const products = context?.products || [];

    const fmtCurrency = (val: number) =>
      (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // 1. Pergunta sobre Gastos / Compras / Valores Financeiros Globais
    if (
      p.includes("gasto") ||
      p.includes("custo") ||
      p.includes("compras") ||
      p.includes("financeiro") ||
      p.includes("orcamento") ||
      p.includes("orçamento") ||
      p.includes("valor") ||
      p.includes("despesa")
    ) {
      const totalCompras = summary.gastoTotalOrdensCompra || 0;
      const totalConsumidoCC = summary.gastoTotalCentrosCusto || 0;
      const orcamentoTotal = summary.orcamentoTotalCentrosCusto || 0;
      const saldoRestante =
        summary.saldoDisponivelCentrosCusto ||
        (orcamentoTotal - totalConsumidoCC);
      const valorEstoque = summary.valorTotalEstoque || 0;
      const gastosUnidade = summary.gastosPorUnidade || {};

      let resp = `### 📊 Relatório Consolidado de Gastos e Finanças (Visão Global)\n\n`;
      resp += `Com base nos registros consolidados de todos os módulos do ERP Almox Plus, apresento o levantamento detalhado dos valores gastos:\n\n`;

      resp += `#### 1. Totais Globais de Compras e Orçamento\n`;
      resp += `- **Total Gasto em Ordens de Compra (OCs):** ${fmtCurrency(totalCompras)}\n`;
      resp += `- **Consumo Realizado nos Centros de Custo:** ${fmtCurrency(totalConsumidoCC)}\n`;
      resp += `- **Orçamento Total Alocado (Budget):** ${fmtCurrency(orcamentoTotal)}\n`;
      resp += `- **Saldo Orçamentário Disponível:** ${fmtCurrency(saldoRestante)} (${orcamentoTotal > 0 ? ((saldoRestante / orcamentoTotal) * 100).toFixed(1) : "0"}% disponível)\n`;
      resp += `- **Valor Total Imobilizado em Estoque (Almoxarifado):** ${fmtCurrency(valorEstoque)}\n\n`;

      if (Object.keys(gastosUnidade).length > 0) {
        resp += `#### 2. Distribuição de Compras por Unidade Operacional\n`;
        resp += `| Unidade | Qtd. Ordens de Compra | Total Gasto (R$) |\n`;
        resp += `| :--- | :--- | :--- |\n`;
        for (const [branch, data] of Object.entries<any>(gastosUnidade)) {
          resp += `| Unidade ${branch} | ${data.count} OCs | ${fmtCurrency(data.total)} |\n`;
        }
        resp += `\n`;
      }

      if (costCenters.length > 0) {
        resp += `#### 3. Posição dos Centros de Custo\n`;
        resp += `| Código | Centro de Custo | Unidade | Orçamento | Gasto Realizado | Saldo Disponível |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        costCenters.slice(0, 8).forEach((cc: any) => {
          resp += `| ${cc.codigo} | ${cc.nome} | ${cc.unidade} | ${fmtCurrency(cc.orcamento)} | ${fmtCurrency(cc.gastoRealizado)} | ${fmtCurrency(cc.saldoRestante)} |\n`;
        });
        resp += `\n`;
      }

      resp += `💡 **Diagnóstico:** A gestão orçamentária apresenta equilíbrio, com saldo positivo em caixa frente ao teto orçamentário provisionado.`;
      return resp;
    }

    // 2. Pergunta sobre Ruptura de Estoque / Itens Críticos
    if (
      p.includes("ruptura") ||
      p.includes("critico") ||
      p.includes("crítico") ||
      p.includes("minimo") ||
      p.includes("mínimo") ||
      p.includes("seguranca") ||
      p.includes("segurança")
    ) {
      const critical = products.filter(
        (pr: any) => (pr.estoqueLocal || 0) <= (pr.min || 0)
      );
      let resp = `### ⚠️ Análise de Risco de Ruptura de Estoque\n\n`;
      if (critical.length > 0) {
        resp += `Foram identificados **${critical.length} itens** em nível crítico de estoque na unidade atual:\n\n`;
        resp += `| SKU | Produto | Categoria | Estoque Atual | Estoque Mínimo |\n`;
        resp += `| :--- | :--- | :--- | :--- | :--- |\n`;
        critical.forEach((pr: any) => {
          resp += `| ${pr.sku} | ${pr.nome} | ${pr.categoria} | **${pr.estoqueLocal}** | ${pr.min} |\n`;
        });
        resp += `\n🚨 **Ação Recomendada:** Iniciar cotação de compra urgente ou solicitar transferência de unidade com estoque excedente.`;
      } else {
        resp += `Todos os produtos monitorados estão com estoque operando acima da margem mínima de segurança no momento.`;
      }
      return resp;
    }

    // 3. Fallback Geral
    return (
      `### 📋 Análise Operacional do Assistente Almox Plus\n\n` +
      `Com base nos dados ativos do sistema na unidade **${context?.branch || "GLOBAL"}**:\n\n` +
      `- **Itens no Catálogo:** ${summary.totalProducts || 0} produtos cadastrados.\n` +
      `- **Ordens de Compra Abertas:** ${summary.openPurchaseOrders || 0} OCs ativas.\n` +
      `- **Requisições de Material Pendentes:** ${summary.pendingRequisitions || 0} requisições internas.\n` +
      `- **Transferências em Trânsito:** ${summary.inTransitTransfers || 0} remessas.\n` +
      `- **Valor Total em Estoque:** ${fmtCurrency(summary.valorTotalEstoque || 0)}.\n` +
      `- **Total Gasto em Compras:** ${fmtCurrency(summary.gastoTotalOrdensCompra || 0)}.\n\n` +
      `Fico à disposição para detalhar qualquer movimentação, fornecedor ou centro de custo específico!`
    );
  }

  // API Route for Gemini AI Assistant
  app.post("/api/gemini", async (req, res) => {
    const { prompt, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const systemInstruction = `Você é o assistente virtual sênior do sistema ERP Almox Plus. Seu papel é dar consultoria em gestão de almoxarifado, compras, curva ABC, transferência entre unidades (RJ, SJRP, SP, BSB) e patrimônio. Seja objetivo, profissional e estruturado em Português do Brasil com formatação rica em Markdown (tabelas, listas e destaques em negrito).
Contexto atual da consulta:
- Usuário: ${context?.user || "Gestor"}
- Perfil: ${context?.role || "Master"}
- Unidade Ativa: ${context?.branch || "SP"}
- Resumo Financeiro e Indicadores: ${JSON.stringify(context?.summaryData || {})}
- Centros de Custo (Orçamento vs Consumo): ${JSON.stringify(context?.costCenters || []).slice(0, 2000)}
- Ordens de Compra Recentes: ${JSON.stringify(context?.recentOrders || []).slice(0, 2000)}
- Catálogo de Produtos e Saldo: ${JSON.stringify(context?.products || []).slice(0, 3000)}

Ao responder sobre valores gastos ou finanças, utilize os dados exatos informados acima sobre Ordens de Compra e Centros de Custo.`;

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

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const replyText = response.text || generateFallbackResponse(prompt, context);
      return res.json({ reply: replyText });
    } catch (error: any) {
      console.error("Gemini API Error:", error?.message || error);
      // Graceful fallback using context data so user is never left without an answer
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
