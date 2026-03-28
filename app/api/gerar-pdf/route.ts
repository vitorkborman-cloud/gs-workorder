import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

// Configuração para permitir execuções longas (Vercel/Serverless)
export const maxDuration = 60;

interface Layer {
  de: string | number;
  ate: string | number;
  tipo: string;
  leitura_voc?: string | number;
  coloracao?: string;
}

export async function POST(request: Request) {
  // Definimos como 'any' para evitar conflitos de versão do Puppeteer
  let browser: any = null;

  try {
    const body = await request.json();
    const { data, layers }: { data: any; layers: Layer[] } = body;

    const isLocal = process.env.NODE_ENV === 'development';

    // --- CONFIGURAÇÃO DO BROWSER (COM CASTING DIRETO PARA EVITAR ERROS NO VS CODE) ---
    browser = await puppeteer.launch({
      args: isLocal ? ['--no-sandbox', '--disable-setuid-sandbox'] : (chromium as any).args,
      defaultViewport: isLocal ? { width: 1280, height: 720 } : (chromium as any).defaultViewport,
      executablePath: isLocal
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Ajuste se usar Mac/Linux
        : await (chromium as any).executablePath(),
      headless: isLocal ? true : (chromium as any).headless,
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
      console.error("Erro ao carregar logo:", e);
    }

    // --- LÓGICA DE CÁLCULO E ESCALA ---
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
        if (t.includes("brita") || t.includes("rach") || t.includes("concreto") || t.includes("cascalho")) bgColor = "#cccccc";
        else if (t.includes("aterro") || t.includes("orgânica") || t.includes("turfa")) bgColor = "#8b7355";
        else if (t.startsWith("areia")) {
            bgColor = t.includes("argil") ? "#E6C27A" : t.includes("silt") ? "#EEDD82" : "#FCE663";
        }
        else if (t.startsWith("silte")) {
            bgColor = t.includes("aren") ? "#D1B280" : t.includes("argil") ? "#B88655" : "#C19A6B";
        }
        else if (t.startsWith("argila")) {
            bgColor = t.includes("aren") ? "#CC6B58" : t.includes("silt") ? "#B86554" : "#D47A6A";
        }

        let texturas: string[] = [];
        let sizes: string[] = [];
        if (t.includes("brita") || t.includes("rach") || t.includes("cascalho")) {
            texturas.push("radial-gradient(circle at 30% 30%, #777 20%, transparent 22%)", "radial-gradient(circle at 70% 70%, #666 22%, transparent 24%)");
            const size = t.includes("rach") ? "24px 24px" : "14px 14px";
            sizes.push(size, size);
        }
        if (t.includes("areia") || t.includes("arenos")) {
            texturas.push("radial-gradient(circle, rgba(0,0,0,0.35) 1px, transparent 1px)");
            sizes.push("6px 6px");
        }
        if (t.includes("argila") || t.includes("argilos")) {
            texturas.push("repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(0,0,0,0.2) 6px, rgba(0,0,0,0.2) 7px)");
            sizes.push("100% 100%");
        }
        if (t.includes("silte") || t.includes("siltos")) {
            texturas.push("repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.15) 5px, rgba(0,0,0,0.15) 6px)");
            sizes.push("100% 100%");
        }
        return `background-color: ${bgColor}; background-image: ${texturas.join(', ')}; background-size: ${sizes.join(', ')};`;
    };

    let construtivoHTML = '';
    const profTotal = parseFloat(data.profundidade_total) || (layers.length ? parseFloat(String(layers[layers.length - 1].ate)) : 10);

    if (hasWell) {
        const leftPoco = 65, widthPoco = 50, leftTubo = 80, widthTubo = 20;
        const yF = getY(profTotal);

        if (!isNaN(preFiltroTopo)) {
            const ySolo = getY(0), hBentonita = getY(preFiltroTopo) - ySolo;
            construtivoHTML += `<div style="position: absolute; left: ${leftPoco}px; width: ${widthPoco}px; top: ${ySolo}px; height: ${hBentonita}px; background-color: #c98a51; border-left: 0.5px solid #333; border-right: 0.5px solid #333; z-index: 4;"></div>`;
            const hPreFiltro = yF - getY(preFiltroTopo);
            construtivoHTML += `<div style="position: absolute; left: ${leftPoco}px; width: ${widthPoco}px; top: ${getY(preFiltroTopo)}px; height: ${hPreFiltro}px; background-color: #fce663; background-image: radial-gradient(black 1px, transparent 1px); background-size: 6px 6px; border-left: 0.5px solid #333; border-right: 0.5px solid #333; border-bottom: 0.5px solid #333; z-index: 4;"></div>`;
        }
        if (!isNaN(filtroTopo)) {
            construtivoHTML += `<div style="position: absolute; left: ${leftTubo - 8}px; width: ${widthTubo + 16}px; top: 0px; height: 10px; background-color: #888; border: 1.5px solid #333; z-index: 6;"></div>`;
            construtivoHTML += `<div style="position: absolute; left: ${leftTubo}px; width: ${widthTubo}px; top: 10px; height: ${getY(filtroTopo) - 10}px; background-color: white; border: 1.5px solid #333; border-top: none; z-index: 5;"></div>`;
        }
        if (!isNaN(filtroTopo) && !isNaN(filtroBase)) {
            const yTF = getY(filtroTopo), yBF = getY(filtroBase);
            construtivoHTML += `<div style="position: absolute; left: ${leftTubo}px; width: ${widthTubo}px; top: ${yTF}px; height: ${yBF - yTF}px; background-color: white; background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, #333 3px, #333 4px); border: 1.5px solid #333; border-top: none; border-bottom: none; z-index: 5;"></div>`;
            construtivoHTML += `
                <div style="position: absolute; left: 115px; width: 10px; top: ${yTF}px; border-top: 0.5px dashed #333; z-index: 10;"></div>
                <div style="position: absolute; left: 128px; top: ${yTF - 8}px; background-color: white; border: 0.5px solid #333; padding: 2px 4px; font-size: 9px; font-weight: bold; border-radius: 3px; z-index: 11; box-shadow: 1px 1px 2px rgba(0,0,0,0.1);">${filtroTopo}m</div>
                <div style="position: absolute; left: 115px; width: 10px; top: ${yBF}px; border-top: 0.5px dashed #333; z-index: 10;"></div>
                <div style="position: absolute; left: 128px; top: ${yBF - 8}px; background-color: white; border: 0.5px solid #333; padding: 2px 4px; font-size: 9px; font-weight: bold; border-radius: 3px; z-index: 11; box-shadow: 1px 1px 2px rgba(0,0,0,0.1);">${filtroBase}m</div>
            `;
            if (getY(profTotal) - yBF > 0) {
                construtivoHTML += `<div style="position: absolute; left: ${leftTubo}px; width: ${widthTubo}px; top: ${yBF}px; height: ${getY(profTotal) - yBF}px; background-color: white; border: 1.5px solid #333; border-top: none; border-bottom: none; z-index: 5;"></div>`;
            }
            construtivoHTML += `<div style="position: absolute; left: ${leftTubo}px; width: ${widthTubo}px; top: ${getY(profTotal) - 5}px; height: 5px; background-color: #333; z-index: 6;"></div>`;
        }
        const dS = data.diametro_sondagem || 'Furo', dP = data.diametro_poco || 'Tubo';
        construtivoHTML += `
            <div style="position: absolute; left: 80px; width: 20px; top: ${yF}px; border-left: 0.5px solid #333; border-right: 0.5px solid #333; border-bottom: 0.5px solid #333; height: 8px; z-index: 10;"></div>
            <div style="position: absolute; left: 90px; top: ${yF + 11}px; transform: translateX(-50%); background-color: white; border: 0.5px solid #333; padding: 2px 4px; font-size: 8px; font-weight: bold; z-index: 11; white-space: nowrap; border-radius: 2px;">Ø ${dP}</div>
            <div style="position: absolute; left: 65px; width: 50px; top: ${yF + 20}px; border-left: 0.5px solid #333; border-right: 0.5px solid #333; border-bottom: 0.5px solid #333; height: 8px; z-index: 10;"></div>
            <div style="position: absolute; left: 90px; top: ${yF + 31}px; transform: translateX(-50%); background-color: white; border: 0.5px solid #333; padding: 2px 4px; font-size: 8px; font-weight: bold; z-index: 11; white-space: nowrap; border-radius: 2px;">Ø ${dS}</div>
        `;
    }

    if (!isNaN(nivelAgua)) {
        const yNA = getY(nivelAgua);
        construtivoHTML += `
            <div style="position: absolute; left: 10px; width: 160px; top: ${yNA}px; border-top: 1.5px solid #005fcc; z-index: 10;"></div>
            <div style="position: absolute; left: 25px; top: ${yNA - 6}px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #005fcc; z-index: 11;"></div>
            <div style="position: absolute; left: 12px; top: ${yNA - 22}px; background-color: white; border: 1px solid #005fcc; padding: 2px 4px; color: #005fcc; font-size: 10px; font-weight: bold; border-radius: 3px; z-index: 11; box-shadow: 1px 1px 2px rgba(0,0,0,0.1);">NA: ${nivelAgua}m</div>
        `;
    }

    // --- MONTAGEM DO HTML ---
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <style>
              *, *::before, *::after { box-sizing: border-box; }
              :root { --escala: ${ESCALA}px; }
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #333; }
              .header-main { width: 100%; border: 2px solid #391e2a; border-collapse: collapse; table-layout: fixed; }
              .header-main td { border: 1.5px solid #391e2a; padding: 6px 10px; vertical-align: middle; overflow: hidden; }
              .logo-cell { width: 160px; text-align: center; background-color: #fff; }
              .title-cell { background-color: #391e2a; color: white; text-align: center; }
              .title-cell h1 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
              .destaque { font-weight: bold; color: #391e2a; text-transform: uppercase; font-size: 9px; margin-right: 4px; }
              .valor { font-size: 11px; }
              .corpo-relatorio { display: flex; flex-direction: column; border: 2px solid #391e2a; border-top: none; }
              .linha-titulos { display: flex; background-color: #80b02d; color: white; font-weight: bold; text-align: center; border-bottom: 2px solid #391e2a; }
              .linha-titulos > div { padding: 10px 5px; border-right: 0.5px solid #391e2a; display: flex; align-items: center; justify-content: center; }
              .linha-titulos > div:last-child { border-right: none; }
              .linha-camada { display: flex; border-bottom: 0.5px solid #391e2a; page-break-inside: avoid; }
              .celula { border-right: 0.5px solid #391e2a; display: flex; align-items: center; justify-content: center; }
              .celula:last-child { border-right: none; }
              .cel-prof { flex-direction: column; justify-content: space-between !important; padding: 4px 0; color: #666; font-size: 10px; }
              .cel-voc { font-weight: bold; color: #80b02d; }
              .cel-desc { flex-direction: row !important; justify-content: flex-start !important; padding: 8px 12px; text-align: left; gap: 12px; }
          </style>
      </head>
      <body>
          <table class="header-main">
              <tr>
                  <td rowspan="3" class="logo-cell">
                      ${logoBase64 ? `<img src="${logoBase64}" style="max-width: 140px; max-height: 80px;" />` : '<b>GREENSOIL</b>'}
                  </td>
                  <td colspan="3" class="title-cell"><h1>Perfil Técnico e Descritivo de Sondagem</h1></td>
              </tr>
              <tr>
                  <td style="width: 25%;"><span class="destaque">ID SONDAGEM:</span><br/><span class="valor">${data.nome_sondagem || '-'}</span></td>
                  <td style="width: 25%;"><span class="destaque">MÉTODO:</span><br/><span class="valor">${data.tipo_sondagem || '-'}</span></td>
                  <td style="width: 50%;"><span class="destaque">COORDENADAS:</span><br/><span class="valor">X: ${data.coord_x || '-'} / Y: ${data.coord_y || '-'}</span></td>
              </tr>
              <tr>
                  <td><span class="destaque">DATA:</span><br/><span class="valor">${data.data || '-'}</span></td>
                  <td><span class="destaque">NÍVEL D'ÁGUA:</span><br/><span class="valor">${data.nivel_agua ? data.nivel_agua + ' m' : '-'}</span></td>
                  <td><span class="destaque">PROF. FINAL:</span><br/><span class="valor">${data.profundidade_total ? data.profundidade_total + ' m' : '-'}</span></td>
              </tr>
          </table>

          <div class="corpo-relatorio">
              <div class="linha-titulos">
                  <div style="width: 65px;">Prof. (m)</div>
                  <div style="width: 65px;">VOC (ppm)</div>
                  <div style="width: 180px;">Perfil Geológico e Construtivo</div>
                  <div style="flex: 1;">Descrição Litológica</div>
              </div>

              <div style="position: relative; width: 100%;">
                  <div style="position: absolute; top: 0; left: 130px; width: 180px; height: 100%; pointer-events: none; z-index: 10;">
                      ${construtivoHTML}
                  </div>
                  ${hasWell ? `<div class="linha-camada" style="height: ${TOP_OFFSET}px; min-height: ${TOP_OFFSET}px; border-bottom: 2px solid #391e2a; background-color: #fff;">
                      <div class="celula" style="width: 65px;"></div><div class="celula" style="width: 65px;"></div><div class="celula" style="width: 180px;"></div><div class="celula" style="flex: 1;"></div>
                  </div>` : ''}

                  ${layers.map((l: Layer) => {
                      const espessura = parseFloat(String(l.ate)) - parseFloat(String(l.de));
                      const estilo = getEstiloSolo(l.tipo);
                      return `
                      <div class="linha-camada" style="min-height: max(40px, calc(${espessura} * var(--escala)));">
                          <div class="celula cel-prof" style="width: 65px;"><span>${l.de}</span><span>${l.ate}</span></div>
                          <div class="celula cel-voc" style="width: 65px;">${l.leitura_voc || '-'}</div>
                          <div class="celula" style="width: 180px; ${estilo}"></div>
                          <div class="celula cel-desc" style="flex: 1;">
                              <div style="width: 28px; height: 28px; border: 0.5px solid #333; border-radius: 4px; ${estilo}"></div>
                              <div class="desc-text-container" style="margin-left: 12px;">
                                  <div><b style="color: #391e2a; font-size: 13px;">${l.tipo ? l.tipo.toUpperCase() : 'N/A'}</b></div>
                                  ${l.coloracao ? `<div style="margin-top: 2px; color: #555;">Coloração: ${l.coloracao}</div>` : ''}
                              </div>
                          </div>
                      </div>`;
                  }).join('')}
                  
                  ${hasWell ? `<div class="linha-camada" style="height: 55px; min-height: 55px; background-color: #fff; border-bottom: none;">
                      <div class="celula" style="width: 65px;"></div><div class="celula" style="width: 65px;"></div><div class="celula" style="width: 180px;"></div><div class="celula" style="flex: 1;"></div>
                  </div>` : ''}
              </div>
          </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Geração do PDF Buffer
    const pdfBuffer: Buffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true, 
      margin: { top: '30px', right: '30px', bottom: '30px', left: '30px' } 
    });

    await browser.close();

    // Convertemos para Uint8Array para o Response do Next.js
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    return new Response(pdfUint8Array, { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/pdf', 
        'Content-Disposition': `attachment; filename="Perfil_${data.nome_sondagem}.pdf"` 
      } 
    });

  } catch (error: any) {
    console.error("Erro ao gerar PDF:", error);
    if (browser) await browser.close();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}