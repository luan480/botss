```js
// ========================================================================
// OLIMPÍADAS — MODAL DE PESQUISA DE PAÍS
// ========================================================================

if (
    i.isModalSubmit() &&
    (i.customId || '').startsWith('olymp_')
) {
    try {
        return await require(
            './commands/olimpiadas/olimpiadas-handler.js'
        ).handle(i);
    } catch (e) {
        console.error(
            '[OLIMPIADAS] Erro no modal:',
            e
        );

        if (
            i.isRepliable() &&
            !i.replied &&
            !i.deferred
        ) {
            await i.reply({
                content:
                    '❌ Erro ao processar a pesquisa do país.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }

    return;
}
```
