-- Dois campos que faltavam pra interpolação de pluma fazer sentido
-- geoestatisticamente (revisão de literatura em docs, ver artigos de
-- krigagem indicadora/dados censurados — ex. "Indicator and probability
-- kriging methods for delineating Cu, Fe, and Mn contamination" e "Using
-- sequential indicator simulation to assess the uncertainty of delineating
-- heavy-metal contaminated soils"):
--
-- 1. Não-detectado / limite de detecção: um boletim de laboratório não dá
--    um número quando o contaminante está abaixo do limite de quantificação
--    — vem como "< 0,5 µg/L". Sem um jeito de registrar isso, a única opção
--    seria digitar um valor inventado (0? o limite? metade do limite?), o
--    que distorce qualquer interpolação depois. Convenção adotada pro
--    cálculo (não pra krigagem indicadora completa, que fica pra depois):
--    concentracao = limite_deteccao / 2, com nao_detectado=true registrando
--    a natureza censurada do dado pra quem for reprocessar com um método
--    melhor.
--
-- 2. Campanha: agrupar lançamentos por data_coleta exata é frágil — uma
--    campanha de campo raramente amostra todos os poços no mesmo dia. Sem
--    um rótulo de rodada, não dá pra saber com confiança quais leituras
--    formam "a mesma foto no tempo" pra desenhar uma pluma de um único
--    momento. Campo livre (não uma tabela separada): mesma convenção leve
--    já usada em CampanhaFQ (app/projetos/[id]/page.tsx), que agrupa
--    physico-químicos por rótulo de data/campanha.
alter table analytical_results
  add column if not exists campanha text,
  add column if not exists nao_detectado boolean not null default false,
  add column if not exists limite_deteccao numeric;

create index if not exists idx_analytical_results_campanha on analytical_results (project_id, campanha);
