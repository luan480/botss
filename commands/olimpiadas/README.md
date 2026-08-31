# 🟨 Olimpíadas de Duplas — WorldWarBR

Sistema independente da Liga.

## Canais
- Painel: `1543944529747382282`
- Resultados: `1071976981924687912`
- TEG Olimpíada: `1543391902252933170`
- Cargo TEG: `1542641616903344268`

## Regras
- 📝 **Registro:** pode ser feito em qualquer dia.
- 🏅 **Contabilização:** somente nos dias pares de setembro/2026.
- 🌎 Cada país só pode ser escolhido por uma dupla.
- 👥 O registro seleciona os dois jogadores; **não existe campo de nome da dupla**.
- 🔎 O país é pesquisado digitando o nome ou parte do nome e depois selecionado no menu.
- 📋 Como o Discord permite no máximo 25 opções por select, resultados grandes são divididos em páginas.
- 🥇 Vitória é o critério principal.
- 🥈 Segundo lugar tem peso 3 **somente para desempate**.
- 🥉 Terceiro lugar tem peso 1 **somente para desempate**.
- 📸 A contabilização exige print da vitória anexado como imagem.

## Fluxo de registro
1. Clique em **Registrar dupla**.
2. Selecione o jogador 1.
3. Selecione o jogador 2.
4. Digite, por exemplo, `Brasil`, `Japão` ou `Alemanha`.
5. O bot mostra os países encontrados.
6. Selecione o país disponível.
7. O registro é salvo e enviado para o canal TEG.

## Comando
`/olimpiadas-painel` — publica o painel oficial das Olimpíadas.

## Arquivos
- `olimpiadas-painel.js`: comando administrativo que publica o painel.
- `olimpiadas-handler.js`: sistema original das Olimpíadas.
- `olimpiadas-patch.js`: novo fluxo de registro com pesquisa de país.
- `olimpiadas.json`: configuração, 100 países e dados persistidos.
