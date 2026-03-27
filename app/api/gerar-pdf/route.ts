import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request: Request) {
  try {
    // 1. Recebe os dados do formulário que o frontend enviou
    const body = await request.json();
    const { data, layers } = body;

    // 2. Inicia o navegador invisível
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // 3. Monta o HTML dinâmico (Aqui entra aquele template que testamos)
    // Veja como inserimos os dados usando ${...} e o .map() para as camadas!
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --escala: 50px; }
            body { font-family: Arial; padding: 20px; font-size: 11px; }
            /* ... (Aqui você colaria todo aquele CSS que fizemos antes) ... */
          </style>
        </head>
        <body>
          <h2>PERFIL TÉCNICO: ${data.nome_sondagem}</h2>
          <p>Nível d'água: ${data.nivel_agua ? data.nivel_agua + 'm' : '-'}</p>
          
          <div style="display: flex; border: 1px solid black;">
             <div style="width: 150px;">
                ${layers.map((layer: any) => {
                  const espessura = parseFloat(layer.ate) - parseFloat(layer.de);
                  return `
                    <div style="
                      height: calc(${espessura} * var(--escala)); 
                      border-bottom: 1px solid black;
                      background-color: ${layer.tipo.includes('Areia') ? '#fce663' : '#d1b280'};
                    ">
                      ${layer.tipo} (${layer.leitura_voc} ppm)
                    </div>
                  `;
                }).join('')}
             </div>
          </div>
        </body>
      </html>
    `;

    // 4. Carrega o HTML na página e manda imprimir o PDF
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    // Converte o Uint8Array do Puppeteer para um Buffer legível pelo Next.js
    const pdfBuffer = Buffer.from(pdfBytes);

    await browser.close();

    // 5. Devolve o arquivo PDF
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Perfil_${data.nome_sondagem}.pdf"`,
      },
    });

  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    return NextResponse.json({ error: 'Erro interno ao gerar o documento' }, { status: 500 });
  }
}