import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

// CONFIGURAÇÃO CRÍTICA PARA VERCEL
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

interface Layer {
  de: string | number;
  ate: string | number;
  tipo: string;
  leitura_voc?: string | number;
  coloracao?: string;
}

export async function POST(request: Request) {
  let browser: any = null;
  const isLocal = process.env.NODE_ENV === 'development';

  try {
    const body = await request.json();
    const { data, layers }: { data: any; layers: Layer[] } = body;

    // Atalho para silenciar o TypeScript
    const chrome: any = chromium;

    // 1. Tenta lançar o browser
    browser = await puppeteer.launch({
      args: isLocal 
        ? ['--no-sandbox', '--disable-setuid-sandbox'] 
        : [...chrome.args, '--hide-scrollbars', '--disable-web-security', '--no-sandbox'],
      defaultViewport: isLocal ? { width: 1080, height: 1920 } : chrome.defaultViewport,
      executablePath: isLocal
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' 
        : await chrome.executablePath(),
      headless: isLocal ? true : chrome.headless,
    });

    const page = await browser.newPage();

    // --- LOGO ---
    let logoBase64 = "";
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (e) {
      console.warn("Logo ignorado.");
    }

    // --- CÁLCULOS ---
    const ESCALA = 45;
    const preFiltroTopo = parseFloat(data.pre_filtro);
    const filtroTopo = parseFloat(data.secao_filtrante_topo);
    const filtroBase = parseFloat(data.secao_filtrante_base);
    const nivelAgua = parseFloat(data.nivel_agua);
    const hasWell = !isNaN(filtroTopo) || !isNaN(preFiltroTopo);
    const TOP_OFFSET = hasWell ? 18 : 0;

    const getY = (depth: string | number) => {
      let y = TOP_OFFSET;
      let d = parseFloat(String(depth));
      if (isNaN(d)) return TOP_OFFSET;
      for (let l of layers) {
        let de = parseFloat(String(l.de));
        let ate = parseFloat(String(l.ate));
        let hOrig = (ate - de) * ESCALA;
        let hStretched = Math.max(40, hOrig);
        if (d <= de) break;
        if (d >= ate) y += hStretched;
        else {
          y += ((d - de) / (ate - de)) * hStretched;
          break;
        }
      }
      return y;
    };

    const getEstiloSolo = (tipo: string) => {
      if (!tipo) return "background-color: #f0f0f0;";
      const t = tipo.toLowerCase().trim();
      let bgColor = "#e0e0e0";
      if (t.includes("brita") || t.includes("rach") || t.includes("cascalho")) bgColor = "#cccccc";
      else if (t.includes("aterro") || t.includes("orgânica")) bgColor = "#8b7355";
      else if (t.startsWith("areia")) bgColor = "#FCE663";
      else if (t.startsWith("silte")) bgColor = "#C19A6B";
      else if (t.startsWith("argila")) bgColor = "#D47A6A";

      return `background-color: ${bgColor}; border-top: 0.5px solid #333;`;
    };

    let construtivoHTML = '';
    const profTotal = parseFloat(data.profundidade_total) || 10;

    if (hasWell) {
      const yF = getY(profTotal);
      if (!isNaN(preFiltroTopo)) {
        construtivoHTML += `<div style="position: absolute; left: 65px; width: 50px; top: ${getY(0)}px; height: ${getY(preFiltroTopo) - getY(0)}px; background-color: #c98a51; z-index: 4; border: 0.5px solid #333;"></div>`;
        construtivoHTML += `<div style="position: absolute; left: 65px; width: 50px; top: ${getY(preFiltroTopo)}px; height: ${yF - getY(preFiltroTopo)}px; background-color: #fce663; z-index: 4; border: 0.5px solid #333;"></div>`;
      }
    }

    const htmlContent = `
      <html>
      <body style="font-family: Arial; padding: 20px;">
        <div style="border: 2px solid #391e2a; padding: 10px; display: flex; align-items: center; justify-content: space-between;">
          ${logoBase64 ? `<img src="${logoBase64}" width="120" />` : '<b>GREENSOIL</b>'}
          <h2>Perfil de Sondagem: ${data.nome_sondagem || '-'}</h2>
        </div>
        <div style="position: relative; margin-top: 20px; border: 1px solid #333;">
            <div style="position: absolute; left: 130px; width: 180px; height: 100%; pointer-events: none; z-index: 10;">
                ${construtivoHTML}
            </div>
            ${layers.map((l: Layer) => `
                <div style="display: flex; min-height: 50px; border-bottom: 1px solid #eee;">
                    <div style="width: 60px; padding: 5px; border-right: 1px solid #333;">${l.de} - ${l.ate}m</div>
                    <div style="flex: 1; padding: 5px; ${getEstiloSolo(l.tipo)}"><b>${l.tipo}</b></div>
                </div>
            `).join('')}
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });

    return new Response(pdf, {
      status: 200,
      headers: { 
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Perfil_${data.nome_sondagem}.pdf"`
      }
    });

  } catch (error: any) {
    console.error("ERRO COMPLETO:", error);
    // Isso vai retornar o erro real para o seu navegador
    return NextResponse.json({ 
      error: "Falha no Deployment", 
      message: error.message,
      stack: error.stack 
    }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}