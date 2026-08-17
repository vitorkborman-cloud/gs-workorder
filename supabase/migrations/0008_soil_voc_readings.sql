-- Lançamento de leitura de PID/VOC desacoplado da descrição de camada — no
-- campo, com liner, a leitura é feita a cada intervalo fixo (ex.: 20cm) ANTES
-- de abrir o liner e saber o tipo de solo; a camada só é descrita depois.
alter table soil_descriptions
  add column if not exists voc_readings jsonb default '[]';
