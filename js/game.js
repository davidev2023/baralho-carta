

import { db, doc, getDoc, updateDoc, onSnapshot } from './firebase.js';

export function gerarBaralho() {
    const naipes = ['♥', '♦', '♣', '♠'];
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let baralho = [];
    let contadorId = 1;

    for (let naipe of naipes) {
        for (let valor of valores) {
            baralho.push({
                idUnico: `c_${contadorId++}`,
                valor: valor,
                naipe: naipe
            });
        }
    }

    for (let i = baralho.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
    }

    return baralho;
}

export function calcularCoringa(vira) {
    if (!vira) return null;
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let idx = valores.indexOf(vira.valor);
    let proximoIdx = (idx + 1) % valores.length;
    return valores[proximoIdx];
}

export function escutarAtualizacoesPartida(idSala, idUsuario, callback) {
    const roomRef = doc(db, 'salas', idSala);
    return onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data());
        }
    });
}

export async function comprarCarta(origem) {
    const urlParams = new URLSearchParams(window.location.search);
    const idSala = urlParams.get('sala') || sessionStorage.getItem('cacheta_sala_id');
    const idUsuario = sessionStorage.getItem('cacheta_user_id');
    const roomRef = doc(db, 'salas', idSala);

    const docSnap = await getDoc(roomRef);
    if (!docSnap.exists()) throw new Error("Sala não encontrada.");

    let dados = docSnap.data();
    if (dados.vezDoJogadorId !== idUsuario) throw new Error("Não é a sua vez de jogar!");
    if (dados.faseTurno !== 'COMPRAR') throw new Error("Você já comprou uma carta neste turno!");

    let baralho = [...dados.baralho];
    let lixo = [...dados.lixo];
    let jogadores = [...dados.jogadores];
    let meuJogador = jogadores.find(j => j.id === idUsuario);

    if (origem === 'baralho') {
        if (baralho.length === 0) throw new Error("O monte de compras acabou!");
        let cartaComprada = baralho.pop();
        meuJogador.mao.push(cartaComprada);
    } else if (origem === 'lixo') {
        if (lixo.length === 0) throw new Error("A lixeira está vazia!");
        let cartaComprada = lixo.pop();
        meuJogador.mao.push(cartaComprada);
    }

    await updateDoc(roomRef, {
        baralho: baralho,
        lixo: lixo,
        jogadores: jogadores,
        faseTurno: 'DESCARTAR'
    });
}

export async function descartarCarta(idCartaParaDescartar) {
    const urlParams = new URLSearchParams(window.location.search);
    const idSala = urlParams.get('sala') || sessionStorage.getItem('cacheta_sala_id');
    const idUsuario = sessionStorage.getItem('cacheta_user_id');
    const roomRef = doc(db, 'salas', idSala);

    const docSnap = await getDoc(roomRef);
    if (!docSnap.exists()) throw new Error("Sala não encontrada.");

    let dados = docSnap.data();
    if (dados.vezDoJogadorId !== idUsuario) throw new Error("Não é a sua vez!");
    if (dados.faseTurno !== 'DESCARTAR') throw new Error("Compre uma carta antes de descartar!");

    let lixo = [...dados.lixo];
    let jogadores = [...dados.jogadores];
    let meuJogador = jogadores.find(j => j.id === idUsuario);

    let idxCarta = meuJogador.mao.findIndex(c => c.idUnico === idCartaParaDescartar);
    if (idxCarta === -1) throw new Error("Carta não encontrada na sua mão.");

    let [cartaDescartada] = meuJogador.mao.splice(idxCarta, 1);
    lixo.push(cartaDescartada);

    let idxAtual = jogadores.findIndex(j => j.id === idUsuario);
    let proximoIdx = (idxAtual + 1) % jogadores.length;
    let proximoJogadorId = jogadores[proximoIdx].id;

    await updateDoc(roomRef, {
        lixo: lixo,
        jogadores: jogadores,
        vezDoJogadorId: proximoJogadorId,
        faseTurno: 'COMPRAR'
    });
}

export function inicializarSistemaPresenca(idSala, idUsuario) {
    // Pronto para expansão via Realtime Database se necessário
}
