-- Renomeia VMP (Valor Máximo Permitido) para CMA (Concentração Máxima
-- Aceitável) — mesmo conceito (limite de referência regulatório usado pra
-- classificar excedência na pluma), só ajustando a nomenclatura usada no
-- sistema.
alter table analytical_results rename column vmp to cma;
alter table analytical_results rename column vmp_fonte to cma_fonte;
