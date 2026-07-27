-- Etapa 2 da reestruturação RDO/Work Order.
-- Absorve os campos do Work Order (checklist técnico) para dentro do RDO,
-- como colunas separadas dos campos nativos do RDO (comentarios/assinaturas)
-- — decisão do usuário, para manter a migração de dados rastreável e não
-- misturar semânticas diferentes antes de decidir se fazem sentido fundidas.

alter table rdo_reports
  add column if not exists checklist_system_data jsonb default '[]',   -- vem de work_orders.system_data ({ equipamento, medicao }[])
  add column if not exists checklist_info text,                          -- vem de work_orders.additional_info
  add column if not exists checklist_images jsonb default '[]',          -- vem de work_orders.additional_images (bucket activity-images)
  add column if not exists checklist_signature_url text;                 -- vem de work_orders.signature_url (bucket signatures)
