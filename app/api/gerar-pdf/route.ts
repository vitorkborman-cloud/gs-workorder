import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

// Configurações vitais para deploy online
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

  try {
    const body = await request.json();
    const { data, layers }: { data: any, layers: Layer[] } = body;

    const isLocal = process.env.NODE_ENV === 'development';
    const chrome: any = chromium;

    // --- CONFIGURAÇÃO DO BROWSER (Resiliente para Serverless) ---
    browser = await puppeteer.launch({
      args: isLocal 
        ? ['--no-sandbox', '--disable-setuid-sandbox'] 
        : [...chrome.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: isLocal ? { width: 1280, height: 720 } : chrome.defaultViewport,
      executablePath: isLocal
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Ajuste se usar Mac
        : await chrome.executablePath(),
      headless: isLocal ? true : chrome.headless,
    });

    const page = await browser.newPage();

    // --- CARREGAMENTO DO LOGO ---
    let logoBase64 = "";
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (e) {
      console.warn("Logo não encontrado, gerando sem imagem.");
    }

    // --- SUA LÓGICA DE ESCALA E CORES (MANTIDA) ---
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

        let texturas: string[] = [];
        let sizes: string[] = [];
        if (t.includes("areia")) { texturas.push("radial-gradient(circle, rgba(0,0,0,0.2) 1px, transparent 1px)"); sizes.push("6px 6px"); }
        if (t.includes("argila")) { texturas.push("repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(0,0,0,0.1) 6px, rgba(0,0,0,0.1) 7px)"); sizes.push("100% 100%"); }

        return `background-color: ${bgColor}; background-image: ${texturas.join(', ')}; background-size: ${sizes.join(', ')};`;
    };

    let construtivoHTML = '';
    const profTotal = parseFloat(data.profundidade_total) || (layers.length ? parseFloat(String(layers[layers.length - 1].ate)) : 10);

    if (hasWell) {
        const leftPoco = 65, widthPoco = 50, leftTubo = 80, widthTubo = 20;
        const yF = getY(profTotal);
        if (!isNaN(preFiltroTopo)) {
            const ySolo = getY(0), hBentonita = getY(preFiltroTopo) - ySolo;
            construtivoHTML += `<div style="position: absolute; left: ${leftPoco}px; width: ${widthPoco}px; top: ${ySolo}px; height: ${hBentonita}px; background-color: #c98a51; border: 0.5px solid #333; z-index: 4;"></div>`;
            construtivoHTML += `<div style="position: absolute; left: ${leftPoco}px; width: ${widthPoco}px; top: ${getY(preFiltroTopo)}px; height: ${yF - getY(preFiltroTopo)}px; background-color: #fce663; border: 0.5px solid #333; z-index: 4;"></div>`;
        }
    }

    // --- MONTAGEM DO HTML ---
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; }
              .header-main { width: 100%; border: 2px solid #391e2a; border-collapse: collapse; }
              .header-main td { border: 1.5px solid #391e2a; padding: 8px; }
              .corpo { border: 2px solid #391e2a; border-top: none; display: flex; flex-direction: column; }
              .linha { display: flex; border-bottom: 0.5px solid #333; min-height: 40px; }
          </style>
      </head>
      <body>
          <table class="header-main">
              <tr>
                  <td style="width: 160px; text-align: center;">
                      ${logoBase64 ? `<img src="${logoBase64}" style="max-width: 140px;" />` : '<b>GREENSOIL</b>'}
                  </td>
                  <td style="background: #391e2a; color: white; text-align: center;">
                      <h2 style="margin: 0; text-transform: uppercase;">Perfil de Sondagem: ${data.nome_sondagem || '-'}</h2>
                  </td>
              </tr>
          </table>
          <div class="corpo">
              <div style="position: relative; width: 100%;">
                  <div style="position: absolute; top: 0; left: 130px; width: 180px; height: 100%; pointer-events: none; z-index: 10;">
                      ${construtivoHTML}
                  </div>
                  ${layers.map((l: Layer) => {
                      const espessura = parseFloat(String(l.ate)) - parseFloat(String(l.de));
                      return `
                      <div class="linha" style="min-height: calc(${espessura} * ${ESCALA}px);">
                          <div style="width: 65px; border-right: 0.5px solid #333; padding: 4px; display: flex; flex-direction: column; justify-content: space-between;">
                              <span>${l.de}</span><span>${l.ate}</span>
                          </div>
                          <div style="width: 65px; border-right: 0.5px solid #333; padding: 4px; text-align: center;">${l.leitura_voc || '-'}</div>
                          <div style="width: 180px; border-right: 0.5px solid #333; ${getEstiloSolo(l.tipo)}"></div>
                          <div style="flex: 1; padding: 8px;"><b>${l.tipo.toUpperCase()}</b><br/>${l.coloracao || ''}</div>
                      </div>`;
                  }).join('')}
              </div>
          </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

    return new Response(new Uint8Array(pdfBuffer), { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename="Perfil_${data.nome_sondagem}.pdf"` 
      } 
    });

  } catch (error: any) {
    console.error("ERRO:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}