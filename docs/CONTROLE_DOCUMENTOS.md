# Controle de Documentos — GS Work Order

Registro interno de numeração SHEQ e histórico de revisões dos documentos
gerados pelo sistema (PDFs e planilhas Excel). Não é exibido no app — serve
para consulta/apresentação (ex.: auditoria) quando solicitado.

A numeração e a versão exibidas em cada documento vêm de uma única fonte no
código: [`lib/pdf/doc-control.ts`](../lib/pdf/doc-control.ts).

## Regra

Sempre que o gerador de um destes documentos for alterado (layout, cálculo,
conteúdo), a versão sobe **+1** em `lib/pdf/doc-control.ts` **e** uma linha é
adicionada ao histórico abaixo, com data e resumo da mudança. Numeração SHEQ
(o número em si) só muda se o documento for formalmente reclassificado —
não sobe a cada atualização de conteúdo.

## Documentos e numeração atual

| Documento                       | SHEQ n° | Versão atual | Gerado em |
|----------------------------------|:-------:|:-------------:|-----------|
| RDO (Relatório Diário de Obra)    | 151     | V 02          | `lib/pdf/rdo.ts` |
| Ficha de Amostragem (PDF)         | 152     | V 00          | `app/projetos/[id]/fisico-quimicos/page.tsx` (`gerarPDFGeral`) |
| Excel de Amostragem               | 153     | V 00          | `app/projetos/[id]/fisico-quimicos/page.tsx` (`gerarExcelGeral`) |
| Ficha Descritiva de Solo          | 154     | V 01          | `lib/pdf/soil-profile.ts` |

(Work Orders mantém a numeração anterior, SHEQ n° 001 — fora do escopo desta
atualização.)

## Histórico de revisões

### 2026-07-23 — Adoção da numeração SHEQ 151–154
Atribuída a numeração SHEQ definitiva aos 4 documentos acima (antes: RDO=004,
Ficha/Excel de Amostragem=002 os dois, Ficha Descritiva de Solo=003). Criado
`lib/pdf/doc-control.ts` como fonte única do número + versão, usado por todos
os geradores. Não conta como revisão de conteúdo (reclassificação de
numeração) — versão mantida em V00 para os quatro.

Contexto: nos dias anteriores a Ficha Descritiva de Solo já havia recebido
melhorias visuais (texturas mais naturais nas camadas de solo, gráfico de
leitura de PID/VOC substituindo o valor solto, fusão visual de camadas
consecutivas do mesmo tipo) — mudanças de conteúdo reais, mas anteriores à
adoção deste controle formal de versão, por isso não numeradas
retroativamente.

### 2026-07-23 — RDO: cabeçalho redesenhado (V00 → V01)
Cabeçalho do PDF do RDO modernizado: hierarquia tipográfica clara (rótulo
"Relatório Diário de Obra" pequeno, nome do projeto em destaque como título
principal — antes as 3 linhas tinham o mesmo peso visual), faixa de destaque
verde na lateral esquerda, e selo (badge) contornado para o número SHEQ/versão
no lugar da linha de texto solta. Fonte do nome do projeto encolhe
automaticamente se for muito longo, sem sobrepor a logo. Nenhuma mudança de
conteúdo/dados, só de layout do cabeçalho.

### 2026-08-05 — RDO: renomeia coluna "Empresa Parceira" para "Empresa" (V01 → V02)
Cabeçalho da tabela "Mão de Obra e Efetivo" — só o rótulo da coluna mudou,
sem alteração de dados/cálculo.

### 2026-08-28 — Ficha Descritiva de Solo: corrige leitura ausente e rótulos colados na margem do gráfico de PID/VOC (V00 → V01)
Duas correções no gráfico de leitura de PID/VOC do perfil:

1. Desde a separação do lançamento de leituras de PID/VOC da descrição de
   camada (`mergeLayersWithVocReadings`), o gráfico só conseguia plotar uma
   leitura quando sua profundidade coincidia com o INÍCIO de algum intervalo
   entre camadas. A última leitura de uma sondagem (feita exatamente na
   profundidade total) nunca é início de intervalo nenhum, então sempre
   ficava de fora do gráfico, mesmo aparecendo corretamente na lista de
   leituras da tela de lançamento. O gráfico agora plota cada leitura na sua
   profundidade real (quando lançada no fluxo novo, separado por leitura) em
   vez de depender do ponto médio da camada mesclada.
2. O rótulo numérico ao lado de cada ponto ficava colado/cortado na linha de
   fronteira da camada sempre que a leitura caía bem naquela profundidade
   (comum, já que as leituras são feitas em profundidades fixas). O texto
   agora sobe um pouco em relação ao marcador, sem alterar a posição real do
   ponto.

Registros antigos (sem leituras separadas) continuam exatamente como antes
em ambos os casos.
