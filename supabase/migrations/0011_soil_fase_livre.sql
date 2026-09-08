-- Indica se foi encontrada fase livre (LNAPL/DNAPL) durante a sondagem —
-- mesmo campo conceitual já usado em water_samplings (amostragem FQ), agora
-- também no Perfil Descritivo de solo.
alter table soil_descriptions
  add column if not exists fase_livre boolean not null default false;
