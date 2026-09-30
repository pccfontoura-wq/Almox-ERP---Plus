import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini AI Assistant
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.json({
          reply: `Análise simulada (Chave Gemini API não configurada): Para o produto consultado na unidade ${context?.branch || 'SP'}, recomendo verificar a reposição com base no lote mínimo de segurança de 20 unidades.`
        });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      const systemInstruction = `Você é o assistente virtual sênior do sistema ERP Almox Plus. Seu papel é dar consultoria em gestão de almoxarifado, compras, curva ABC, transferência entre unidades (RJ, SJRP, SP, BSB) e patrimônio. Seja objetivo, profissional e estruturado em Português do Brasil. Responda exclusivamente com base nos dados do sistema ou fornecendo análises preventivas e acionáveis.
Contexto atual da consulta:
- Usuário: ${context?.user || 'Gestor'}
- Perfil: ${context?.role || 'Master'}
- Unidade Ativa: ${context?.branch || 'SP'}
- Resumo de Estoque & Indicadores: ${JSON.stringify(context?.summaryData || {})}
- Catálogo de Produtos e Saldo: ${JSON.stringify(context?.products || []).slice(0, 3000)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `${systemInstruction}\n\nPergunta do usuário: ${prompt}`
      });

      const replyText = response.text || "Não foi possível gerar uma resposta no momento.";
      return res.json({ reply: replyText });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({
        reply: "Ocorreu um erro ao consultar o modelo de inteligência artificial."
      });
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
