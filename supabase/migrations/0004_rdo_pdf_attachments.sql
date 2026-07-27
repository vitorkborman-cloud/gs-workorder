-- Etapa 2 da reestruturação RDO/Work Order.
-- Referências (não os PDFs em si) a perfis de solo/amostragens físico-químicas
-- finalizados para anexar como páginas extras ao gerar o PDF final do RDO.
-- O merge acontece sob demanda (lib/pdf/merge.ts, etapa 5) — nada é
-- pré-gerado nem duplicado aqui, evitando anexos desatualizados.

alter table rdo_reports
  add column if not exists pdf_attachments jsonb default '[]';
  -- formato: [{ tipo: 'soil_description' | 'water_sampling', id: uuid, ordem: integer }]
