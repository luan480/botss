# 🟨 Olimpíadas de Duplas — WorldWarBR

Sistema independente da Liga.

## Canais
- Painel: `1543944529747382282`
- Resultados: `1071976981924687912`
- TEG Olimpíada: `1543391902252933170`

## Regras implementadas
- Cadastro de duplas somente nos dias pares de setembro/2026.
- Um país não pode ser escolhido por duas duplas.
- O cadastro usa menus para selecionar jogadores e país.
- A contabilização pergunta separadamente o país campeão, o segundo e o terceiro.
- 🥇 vitória é o critério principal de classificação.
- 🥈 segundo lugar vale peso 3 somente para desempate.
- 🥉 terceiro lugar vale peso 1 somente para desempate.
- Resultado é enviado ao canal de resultados.
- O print da vitória pode ser anexado no fluxo de contabilização.
- Apenas duas duplas são consideradas vencedoras no fechamento.

## Comando
`/olimpiadas-painel` — publica o painel das Olimpíadas.

## Arquivos
- `olimpiadas-painel.js`: comando administrativo para publicar o painel.
- `olimpiadas-handler.js`: menus, registros, contabilização, ranking e resultados.
- `olimpiadas.json`: dados persistidos da competição.
