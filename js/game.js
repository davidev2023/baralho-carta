import { db, doc, getDoc, updateDoc, setDoc, onSnapshot } from './firebase.js';

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

export function escutarAtualizacoesPartida(idSala, callback) {
    const roomRef = doc(db, 'salas', idSala);
    return onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data());
        }
    });
}

export async function entrarNaSala(idSala, idUsuario, nomeSalvo) {
    const roomRef = doc(db, 'salas', idSala);
    const docSnap = await getDoc(roomRef);
    
    if (!docSnap.exists()) {
        await setDoc(roomRef, {
            criador: idUsuario,
            emAndamento: false,
            faseTurno: 'COMPRAR',
            vezDoJogadorId: idUsuario,
            baralho: [],
            lixo: [],
            vira: null,
            coringa: null,
            jogadores: [{ id: idUsuario, nome: nomeSalvo, mao: [], pontos: 0, status: 'online' }],
            vencedor: null
        });
    } else {
        let dados = docSnap.data();
        let jogadores = dados.jogadores || [];
        let jogadorExistente = jogadores.find(j => j.id === idUsuario);
        
        if (!jogadorExistente && !dados.emAndamento) {
            jogadores.push({ id: idUsuario, nome: nomeSalvo, mao: [], pontos: 0, status: 'online' });
            await updateDoc(roomRef, { jogadores });
        } else if (jogadorExistente && jogadorExistente.nome !== nomeSalvo) {
            jogadorExistente.nome = nomeSalvo;
            await updateDoc(roomRef, { jogadores });
        }
    }
}

export async function sairDaSala(idSala, idUsuario) {
    const roomRef = doc(db, 'salas', idSala);
    const docSnap = await getDoc(roomRef);
    if (docSnap.exists()) {
        let dados = docSnap.data();
        let jogadoresAtualizados = (dados.jogadores || []).filter(j => j.id !== idUsuario);
        await updateDoc(roomRef, { jogadores: jogadoresAtualizados });
    }
}

export async function iniciarPartida(idSala) {
    const roomRef = doc(db, 'salas', idSala);
    const docSnap = await getDoc(roomRef);
    if (!docSnap.exists()) throw new Error("Sala não encontrada.");

    let dados = docSnap.data();
    let listaJogadores = [...dados.jogadores];
    const baralho = gerarBaralho();

    listaJogadores.forEach(j => {
        j.mao = baralho.splice(0, 9);
        if (j.pontos === undefined || j.pontos === null) {
            j.pontos = 0;
        }
    });

    const vira = baralho.pop();
    const coringa = calcularCoringa(vira);

    await updateDoc(roomRef, {
        emAndamento: true,
        faseTurno: 'COMPRAR',
        vezDoJogadorId: listaJogadores[0].id,
        baralho: baralho,
        lixo: [],
        vira: vira,
        coringa: coringa,
        jogadores: listaJogadores,
        vencedor: null
    });
}

export function validarTrincaOuSequencia(cartas, coringaValor) {
    if (cartas.length < 3) return false;

    const coringas = cartas.filter(c => c.valor === coringaValor);
    const normais = cartas.filter(c => c.valor !== coringaValor);

    if (normais.length > 0) {
        const primeiroValor = normais[0].valor;
        const mesmoValor = normais.every(c => c.valor === primeiroValor);
        if (mesmoValor) {
            const naipesSet = new Set(normais.map(c => c.naipe));
            if (naipesSet.size === normais.length && cartas.length <= 4) {
                return true;
            }
        }
    } else {
        if (cartas.length <= 4) return true;
    }

    if (normais.length > 0) {
        const primeiroNaipe = normais[0].naipe;
        const mesmoNaipe = normais.every(c => c.naipe === primeiroNaipe);
        
        if (mesmoNaipe) {
            const ordemValores = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
            
            let minVal = Math.min(...normais.map(c => ordemValores[c.valor]));
            let maxVal = Math.max(...normais.map(c => ordemValores[c.valor]));
            
            const amplitude = maxVal - minVal + 1;
            if (amplitude <= cartas.length && (maxVal - minVal < 13)) {
                const valoresNormaisUnicos = new Set(normais.map(c => c.valor));
                if (valoresNormaisUnicos.size === normais.length) {
                    return true;
                }
            }
        }
    } else if (cartas.length >= 3) {
        return true;
    }

    return false;
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

export async function baterJogo(gruposMarcados, ordemLocalMao) {
    const urlParams = new URLSearchParams(window.location.search);
    const idSala = urlParams.get('sala') || sessionStorage.getItem('cacheta_sala_id');
    const idUsuario = sessionStorage.getItem('cacheta_user_id');
    const roomRef = doc(db, 'salas', idSala);

    const docSnap = await getDoc(roomRef);
    if (!docSnap.exists()) throw new Error("Sala não encontrada.");

    let dados = docSnap.data();
    if (dados.vezDoJogadorId !== idUsuario) throw new Error("Não é a sua vez de jogar!");

    const idsEmGrupos = new Set();
    gruposMarcados.forEach(grupo => {
        grupo.forEach(c => idsEmGrupos.add(c.idUnico));
    });

    const cartasSoltas = ordemLocalMao.filter(c => !idsEmGrupos.has(c.idUnico));
    if (cartasSoltas.length > 1) {
        throw new Error(`Você ainda tem ${cartasSoltas.length} cartas soltas na mão! Agrupe-as antes de bater.`);
    }

    let jogadoresAtualizados = dados.jogadores.map(j => {
        if (j.id === idUsuario) {
            return { ...j, pontos: (j.pontos || 0) + 50 };
        }
        return j;
    });

    let jogadorVencedor = jogadoresAtualizados.find(j => j.id === idUsuario);
    
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR');
    const horarioFormatado = agora.toLocaleTimeString('pt-BR');

    const infoVencedor = {
        id: jogadorVencedor.id,
        nome: jogadorVencedor.nome,
        pontos: jogadorVencedor.pontos,
        dataHora: `${dataFormatada} às ${horarioFormatado}`
    };

    await updateDoc(roomRef, {
        emAndamento: false,
        jogadores: jogadoresAtualizados,
        vencedor: infoVencedor
    });
}

export function inicializarSistemaPresenca(idSala, idUsuario) {
    // Mantido para compatibilidade
}
