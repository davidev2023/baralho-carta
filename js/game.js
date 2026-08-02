import { db } from './firebase.js';
import { doc, onSnapshot, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const playerId = localStorage.getItem('cacheta_playerId');

if (!roomId || !playerId) {
    window.location.href = 'index.html';
}

document.getElementById('roomDisplay').innerText = `Mesa: ${roomId}`;

document.getElementById('leaveBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

let selectedCardIndex = null;
let estadoJogoCache = null;

const roomRef = doc(db, "mesas", roomId);

onSnapshot(roomRef, (docSnap) => {
    if (docSnap.exists()) {
        estadoJogoCache = docSnap.data();
        atualizarInterface(estadoJogoCache);
    }
});

function criarElementoCarta(textoCarta) {
    const cardEl = document.createElement('div');
    if (!textoCarta || textoCarta === 'Vazio') {
        cardEl.className = 'card discard';
        cardEl.innerHTML = `<span class="card-top"></span><span class="card-center">Vazio</span><span class="card-bottom"></span>`;
        return cardEl;
    }

    const valor = textoCarta.slice(0, -1);
    const naipe = textoCarta.slice(-1);
    const isRed = naipe === '♥' || naipe === '♦';

    cardEl.className = `card ${isRed ? 'red' : 'black'}`;
    cardEl.innerHTML = `
        <span class="card-top">${valor}${naipe}</span>
        <span class="card-center">${naipe}</span>
        <span class="card-bottom">${valor}${naipe}</span>
    `;
    return cardEl;
}

// Descobre qual carta é o coringa com base na carta vira
function obterCoringa(cartaVira) {
    if (!cartaVira) return "-";
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let valorVira = cartaVira.slice(0, -1);
    let index = valores.indexOf(valorVira);
    let indexProximo = (index + 1) % valores.length;
    return valores[indexProximo]; // Ex: se vira é 5, coringa é 6
}

function atualizarInterface(data) {
    const adminControls = document.getElementById('adminControls');
    const btnIniciar = document.getElementById('btnIniciarPartida');

    if (playerId === 'p1') {
        adminControls.style.display = 'block';
        btnIniciar.innerText = (data.status === 'jogando') ? "Reiniciar Partida" : "Iniciar Partida";
    } else {
        adminControls.style.display = 'none';
    }

    const statusTurno = document.getElementById('statusTurno');
    const meuTurno = data.turno === playerId;

    // Atualizar visual do Coringa na mesa
    const coringaPile = document.getElementById('coringaPile');
    coringaPile.innerHTML = '<div style="font-size:0.75rem; margin-bottom:2px;">Vira</div>';
    if (data.vira) {
        coringaPile.appendChild(criarElementoCarta(data.vira));
        document.getElementById('coringaTexto').innerText = `Coringa da Rodada: ${obterCoringa(data.vira)}`;
    } else {
        document.getElementById('coringaTexto').innerText = `Coringa: -`;
    }

    if (data.status === 'aguardando') {
        statusTurno.innerText = "Aguardando o criador iniciar a partida...";
    } else if (data.status === 'fim') {
        statusTurno.innerText = `🏆 Fim de jogo! ${data.vencedorNome} venceu!`;
    } else if (meuTurno) {
        statusTurno.innerText = (data.faseTurno === 'comprar') ? "Sua vez! Compre do monte ou da lixeira." : "Sua vez! Organize, descarte ou bata.";
    } else {
        statusTurno.innerText = "Turno de outro jogador...";
    }

    document.getElementById('deckCount').innerText = data.monte ? data.monte.length : 0;
    
    const discardPile = document.getElementById('discardPile');
    discardPile.innerHTML = '';
    if (data.lixeira && data.lixeira.length > 0) {
        discardPile.appendChild(criarElementoCarta(data.lixeira[data.lixeira.length - 1]));
    } else {
        discardPile.appendChild(criarElementoCarta('Vazio'));
    }

    // Placar
    const playersArea = document.getElementById('playersArea');
    playersArea.innerHTML = '';
    if (data.jogadores) {
        data.jogadores.forEach(p => {
            const isVez = (data.status === 'jogando' && data.turno === p.id) ? '⭐' : '';
            playersArea.innerHTML += `
                <div class="player-card-info">
                    <strong>${p.nome} ${isVez}</strong><br>
                    <span>Cartas: ${p.mao ? p.mao.length : 0}</span><br>
                    <span style="color: #f1c40f;">🏆 ${p.vitorias || 0} vitórias</span>
                </div>
            `;
        });
    }

    // Mão do Jogador (Com suporte a toque para reorganizar e selecionar)
    const meuObjeto = data.jogadores.find(p => p.id === playerId);
    if (meuObjeto && meuObjeto.mao) {
        const handDiv = document.getElementById('playerHand');
        handDiv.innerHTML = '';
        meuObjeto.mao.forEach((carta, index) => {
            const cardEl = criarElementoCarta(carta);
            if (index === selectedCardIndex) {
                cardEl.classList.add('selected');
            }

            // Sistema de toque/clique para organizar ou selecionar
            cardEl.onclick = () => {
                if (selectedCardIndex === null) {
                    selectedCardIndex = index; // Seleciona para descartar
                } else if (selectedCardIndex === index) {
                    selectedCardIndex = null; // Deseleciona
                } else {
                    // Se já tinha uma selecionada e clicou em outra, troca de lugar na mão (Organizar com o dedo!)
                    let maoTemp = [...meuObjeto.mao];
                    let cartaMovida = maoTemp.splice(selectedCardIndex, 1)[0];
                    maoTemp.splice(index, 0, cartaMovida);
                    meuObjeto.mao = maoTemp;
                    selectedCardIndex = null;
                    salvarMaoReordenada(meuObjeto.mao);
                }
                atualizarInterface(estadoJogoCache);
            };

            handDiv.appendChild(cardEl);
        });
    }

    // Botões
    const btnMonte = document.getElementById('btnComprarMonte');
    const btnLixeira = document.getElementById('btnComprarLixeira');
    const btnDescartar = document.getElementById('btnDescartar');
    const btnBater = document.getElementById('btnBater');

    if (data.status === 'jogando' && meuTurno) {
        if (data.faseTurno === 'comprar') {
            btnMonte.removeAttribute('disabled');
            btnLixeira.removeAttribute('disabled');
            btnDescartar.setAttribute('disabled', 'true');
            btnBater.style.display = 'none';
        } else {
            btnMonte.setAttribute('disabled', 'true');
            btnLixeira.setAttribute('disabled', 'true');
            if (selectedCardIndex !== null) {
                btnDescartar.removeAttribute('disabled');
            } else {
                btnDescartar.setAttribute('disabled', 'true');
            }
            // Botão Bater aparece na fase de descarte se tiver 10 cartas na mão
            if (meuObjeto.mao.length === 10) {
                btnBater.style.display = 'block';
                btnBater.removeAttribute('disabled');
            } else {
                btnBater.style.display = 'none';
            }
        }
    } else {
        btnMonte.setAttribute('disabled', 'true');
        btnLixeira.setAttribute('disabled', 'true');
        btnDescartar.setAttribute('disabled', 'true');
        btnBater.style.display = 'none';
    }
}

async function salvarMaoReordenada(novaMao) {
    let jogadores = [...estadoJogoCache.jogadores];
    let jIndex = jogadores.findIndex(j => j.id === playerId);
    jogadores[jIndex].mao = novaMao;
    await updateDoc(roomRef, { jogadores });
}

// Iniciar / Reiniciar
document.getElementById('btnIniciarPartida')?.addEventListener('click', async () => {
    const naipes = ['♠', '♥', '♦', '♣'];
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    let baralho = [];
    naipes.forEach(naipe => {
        valores.forEach(valor => { baralho.push(valor + naipe); });
    });

    for (let i = baralho.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
    }

    const snap = await getDoc(roomRef);
    const data = snap.data();
    let jogadores = data.jogadores;

    jogadores.forEach(j => {
        j.mao = baralho.splice(0, 9); // Começam com 9
    });

    const cartaVira = baralho.pop();
    const lixeiraInicial = [baralho.pop()];
    selectedCardIndex = null;

    await updateDoc(roomRef, {
        status: "jogando",
        faseTurno: "comprar",
        turno: jogadores[0].id,
        monte: baralho,
        lixeira: lixeiraInicial,
        vira: cartaVira,
        jogadores: jogadores,
        vencedorNome: null
    });
});

document.getElementById('btnComprarMonte').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'comprar') return;
    let monte = [...estadoJogoCache.monte];
    if (monte.length === 0) { alert("Monte vazio!"); return; }

    const carta = monte.pop();
    let jogadores = [...estadoJogoCache.jogadores];
    jogadores.find(j => j.id === playerId).mao.push(carta);

    await updateDoc(roomRef, { monte, jogadores, faseTurno: 'descartar' });
});

document.getElementById('btnComprarLixeira').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'comprar') return;
    let lixeira = [...estadoJogoCache.lixeira];
    if (lixeira.length === 0) { alert("Lixeira vazia!"); return; }

    const carta = lixeira.pop();
    let jogadores = [...estadoJogoCache.jogadores];
    jogadores.find(j => j.id === playerId).mao.push(carta);

    await updateDoc(roomRef, { lixeira, jogadores, faseTurno: 'descartar' });
});

// Descartar normal (passa a vez)
document.getElementById('btnDescartar').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'descartar' || selectedCardIndex === null) return;

    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);

    if (jogadorAtual.mao.length !== 10) {
        alert("Você precisa comprar uma carta antes de descartar!");
        return;
    }

    const cartaDescartada = jogadorAtual.mao.splice(selectedCardIndex, 1)[0];
    selectedCardIndex = null;

    let lixeira = [...estadoJogoCache.lixeira];
    lixeira.push(cartaDescartada);

    let currentIndex = jogadores.findIndex(j => j.id === playerId);
    let nextIndex = (currentIndex + 1) % jogadores.length;

    await updateDoc(roomRef, {
        lixeira,
        jogadores,
        turno: jogadores[nextIndex].id,
        faseTurno: 'comprar'
    });
});

// Bater / Fechar o Jogo
document.getElementById('btnBater').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || selectedCardIndex === null) return;

    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);

    // O jogador descarta a última carta para fechar as combinações válidas
    const cartaDescartada = jogadorAtual.mao.splice(selectedCardIndex, 1)[0];
    selectedCardIndex = null;

    let lixeira = [...estadoJogoCache.lixeira];
    lixeira.push(cartaDescartada);

    jogadorAtual.vitorias = (jogadorAtual.vitorias || 0) + 1;

    await updateDoc(roomRef, {
        lixeira,
        jogadores,
        status: 'fim',
        vencedorNome: jogadorAtual.nome
    });
});
