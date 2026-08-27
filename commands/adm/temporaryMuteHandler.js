const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const punicoesPath = path.join(__dirname, '..', 'liga', 'punicoes.json');
const INTERVALO_MS = 15000;

function carregar() {
    const dados = safeReadJson(punicoesPath);
    return dados && typeof dados === 'object' ? dados : {};
}

async function processarMutes(client) {
    const punicoes = carregar();
    let alterou = false;
    const agora = Date.now();

    for (const [userId, dados] of Object.entries(punicoes)) {
        const terminaEm = Number(dados?.muteAte || 0);
        if (!terminaEm) continue;

        const guild = client.guilds.cache.get(process.env.GUILD_ID || '849696655510863914');
        if (!guild) continue;

        const membro = await guild.members.fetch(userId).catch(() => null);
        if (!membro) {
            if (terminaEm <= agora) {
                delete dados.muteAte;
                alterou = true;
            }
            continue;
        }

        if (terminaEm <= agora) {
            if (membro.voice.channel && membro.voice.serverMute) {
                await membro.voice.setMute(false, 'Fim do silenciamento temporário').catch(() => null);
            }
            delete dados.muteAte;
            alterou = true;
            continue;
        }

        // Se o usuário entrar em voz durante o período, o mute é aplicado novamente.
        if (membro.voice.channel && !membro.voice.serverMute) {
            await membro.voice.setMute(true, 'Silenciamento temporário ativo').catch(() => null);
        }
    }

    if (alterou) safeWriteJson(punicoesPath, punicoes);
}

module.exports = client => {
    const executar = () => processarMutes(client).catch(err => console.error('[MUTE TEMPORÁRIO]', err));

    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (!newState.channelId || oldState.channelId === newState.channelId) return;
        const punicoes = carregar();
        const dados = punicoes[newState.id];
        const terminaEm = Number(dados?.muteAte || 0);
        if (!terminaEm) return;

        if (terminaEm <= Date.now()) {
            delete dados.muteAte;
            safeWriteJson(punicoesPath, punicoes);
            return;
        }

        await newState.member.voice.setMute(true, 'Silenciamento temporário ativo').catch(() => null);
    });

    executar();
    setInterval(executar, INTERVALO_MS);
};
