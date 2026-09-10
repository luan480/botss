'use strict';

/*
 * Compatibilidade para URLs de anexos no discord.js/Node 19.
 *
 * O DataResolver do discord.js 14 usa `fetch(url)` do undici para transformar
 * URLs em Buffer. Em alguns ambientes Node 19 isso pode terminar com:
 *   "The stream argument must be an instance of Stream. Received an instance
 *    of ReadableStream"
 *
 * Para GET/HEAD simples, baixamos a URL usando o cliente HTTP nativo do Node
 * e devolvemos um Response do próprio undici. Assim o restante do discord.js
 * continua usando exatamente a API esperada e as chamadas REST normais não
 * são alteradas.
 */

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const undici = require('undici');

const fetchOriginal = undici.fetch;
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

function baixar(urlString, metodo = 'GET', redirects = 0) {
    return new Promise((resolve, reject) => {
        let url;
        try {
            url = new URL(urlString);
        } catch (erro) {
            reject(erro);
            return;
        }

        const transport = url.protocol === 'https:' ? https : http;
        const request = transport.request(url, {
            method: metodo,
            headers: {
                'User-Agent': 'WorldWarBR-DiscordBot/1.0'
            }
        }, response => {
            const status = response.statusCode || 0;

            if (status >= 300 && status < 400 && response.headers.location) {
                response.resume();

                if (redirects >= MAX_REDIRECTS) {
                    reject(new Error(`Redirecionamentos demais ao baixar anexo (HTTP ${status})`));
                    return;
                }

                const destino = new URL(response.headers.location, url).toString();
                baixar(destino, metodo, redirects + 1).then(resolve, reject);
                return;
            }

            if (metodo === 'HEAD') {
                response.resume();
                resolve({
                    status,
                    headers: response.headers,
                    body: Buffer.alloc(0)
                });
                return;
            }

            if (status < 200 || status >= 300) {
                response.resume();
                reject(new Error(`Falha ao baixar anexo: HTTP ${status}`));
                return;
            }

            const tamanhoDeclarado = Number(response.headers['content-length'] || 0);
            if (tamanhoDeclarado > MAX_BYTES) {
                response.resume();
                reject(new Error(`Anexo excede o limite de ${MAX_BYTES} bytes`));
                return;
            }

            const partes = [];
            let total = 0;

            response.on('data', parte => {
                total += parte.length;

                if (total > MAX_BYTES) {
                    response.destroy(new Error(`Anexo excede o limite de ${MAX_BYTES} bytes`));
                    return;
                }

                partes.push(parte);
            });

            response.once('end', () => {
                resolve({
                    status,
                    headers: response.headers,
                    body: Buffer.concat(partes)
                });
            });

            response.once('error', reject);
        });

        request.setTimeout(TIMEOUT_MS, () => {
            request.destroy(new Error(`Timeout de ${TIMEOUT_MS}ms ao baixar anexo`));
        });

        request.once('error', reject);
        request.end();
    });
}

undici.fetch = async function fetchCompat(input, init = {}) {
    const metodo = String(init.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input?.url;

    // Mantém o undici original para qualquer chamada que não seja o GET/HEAD
    // simples usado pelo DataResolver para anexos.
    if (!url || (metodo !== 'GET' && metodo !== 'HEAD') || init.body != null) {
        return fetchOriginal(input, init);
    }

    const resultado = await baixar(url, metodo);

    return new undici.Response(resultado.body, {
        status: resultado.status,
        headers: resultado.headers
    });
};

module.exports = { baixar };
