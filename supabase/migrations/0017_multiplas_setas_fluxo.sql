-- Um mesmo site pode ter mais de um sentido de fluxo — comprovado por um
-- laudo real de mapa potenciométrico (BRAPAR/Brenntag Jundiaí, ago/2026):
-- "fluxo preferencial... Sudoeste, com uma inflexão para oeste-sudoeste na
-- área do galpão e administração, e variação para sul-sudoeste na área do
-- parque de tanques". O mapa potenciométrico é uma superfície (curvas de
-- igual carga hidráulica), não um vetor único — por isso a restrição de
-- "uma seta por rodada" da migração anterior estava errada.
--
-- Remove a constraint de unicidade (agora várias setas por rodada, uma por
-- sub-região do site) e adiciona um rótulo opcional pra identificar cada
-- zona (ex. "Galpão/Administração", "Parque de Tanques").
alter table groundwater_flow_directions drop constraint if exists groundwater_flow_directions_project_id_rodada_key;

alter table groundwater_flow_directions add column if not exists rotulo text;
