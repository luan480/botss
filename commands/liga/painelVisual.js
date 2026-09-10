/* ========================================================================
   PAINEL DA LIGA — INTEGRAÇÃO VISUAL DOS BOTÕES

   O painel usa Components V2. O ContainerBuilder aceita ActionRows como
   componentes internos, fazendo os botões aparecerem visualmente dentro
   do próprio painel em vez de ficarem como uma barra separada abaixo dele.

   Este adaptador mantém o painelCore intacto e normaliza apenas o payload
   do painel da Liga no momento do envio/edição.
   ======================================================================== */

function integrarBotoesNoContainer(payload) {
    if (!payload || !Array.isArray(payload.components)) {
        return payload;
    }

    if (payload.components.length !== 2) {
        return payload;
    }

    const [container, actionRow] = payload.components;

    if (
        !container ||
        !actionRow ||
        typeof container.addActionRowComponents !== 'function'
    ) {
        return payload;
    }

    container.addActionRowComponents(actionRow);
    payload.components = [container];

    return payload;
}

function criarCanalAdaptado(canal) {
    if (!canal || canal.__ligaPainelVisualAdaptado) {
        return canal;
    }

    const originalSend =
        typeof canal.send === 'function'
            ? canal.send.bind(canal)
            : null;

    if (originalSend) {
        canal.send = function sendPainelLiga(payload, ...resto) {
            return originalSend(
                integrarBotoesNoContainer(payload),
                ...resto
            );
        };
    }

    if (canal.messages && typeof canal.messages.fetch === 'function') {
        const originalFetch = canal.messages.fetch.bind(canal.messages);

        canal.messages.fetch = async function fetchPainelLigaMensagem(...args) {
            const mensagem = await originalFetch(...args);

            if (
                mensagem &&
                typeof mensagem.edit === 'function' &&
                !mensagem.__ligaPainelVisualAdaptado
            ) {
                const originalEdit = mensagem.edit.bind(mensagem);

                mensagem.edit = function editPainelLiga(payload, ...resto) {
                    return originalEdit(
                        integrarBotoesNoContainer(payload),
                        ...resto
                    );
                };

                mensagem.__ligaPainelVisualAdaptado = true;
            }

            return mensagem;
        };
    }

    canal.__ligaPainelVisualAdaptado = true;
    return canal;
}

module.exports = {
    integrarBotoesNoContainer,
    criarCanalAdaptado
};
