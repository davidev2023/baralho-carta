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

// Função auxiliar para estruturar o HTML bonito da carta igual à referência
function criarElementoCarta(textoCarta, isClickable = false) {
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

function atualizarInterface(data) {
    const adminControls = document.getElementById('adminControls');
    const btnIniciar = document.getElementById('btnIniciarPartida');

    if (playerId === 'p1') {
        adminControls.style.display = 'block';
        if (data.status === 'jogando') {
            btnIniciar.innerText = "Reiniciar Partida";
        } else {
            btnIniciar.innerText = "Iniciar Partida";
        }
    } else {
        adminControls.style.display = 'none';
    }

    const statusTurno = document.getElementById('statusTurno');
    const meuTurno = data.turno === playerId;

    if (data.status === 'aguardando') {
        statusTurno.innerText = "Aguardando o criador iniciar a partida...";
    } else if (data.status === 'fim') {
        statusTurno.innerText = `🏆 Fim de jogo! ${data.vencedorNome} venceu a partida!`;
    } else if (meuTurno) {
        if (data.faseTurno === 'comprar') {
            statusTurno.innerText = "Sua vez! Compre do Monte ou pegue da Lixeira.";
        } else {
            statusTurno.innerText = "Sua vez! Selecione uma carta para descartar.";
        }
    } else {
        statusTurno.innerText = "Turno de outro jogador...";
    }

    // Contadores e Lixeira
    document.getElementById('deckCount').innerText = data.monte ? data.monte.length : 0;
    
    const discardPile = document.getElementById('discardPile');
    discardPile.innerHTML = '';
    if (data.lixeira && data.lixeira.length > 0) {
        const ultimaCarta = data.lixeira[data.lixeira.length - 1];
        discardPile.appendChild(criarElementoCarta(ultimaCarta));
    } else {
        discardPile.appendChild(criarElementoCarta('Vazio'));
    }

    // Jogadores e Placar de Vitórias
    const playersArea = document.getElementById('playersArea');
    playersArea.innerHTML = '';
    if (data.jogadores) {
        data.jogadores.forEach(p => {
            const isVez = (data.status === 'jogando' && data.turno === p.id) ? '⭐' : '';
            const vitorias = p.vitorias || 0;
            playersArea.innerHTML += `
                <div class="player-card-info">
                    <strong>${p.nome} ${isVez}</strong><br>
                    <span>Cartas: ${p.mao ? p.mao.length : 0}</span><br>
                    <span style="color: #f1c40f; font-weight: bold;">🏆 ${vitorias} vitórias</span>
                </div>
            `;
        });
    }

    // Mão do jogador atual com animações e visual estilizado
    const meuObjeto = data.jogadores.find(p => p.id === playerId);
    if (meuObjeto && meuObjeto.mao) {
        const handDiv = document.getElementById('playerHand');
        handDiv.innerHTML = '';
        meuObjeto.mao.forEach((carta, index) => {
            const cardEl = criarElementoCarta(carta, true);
            if (index === selectedCardIndex) {
                cardEl.classList.add('selected');
            }
            cardEl.onclick = () => selecionarCarta(index, cardEl);
            handDiv.appendChild(cardEl);
        });
    }

    // Controle de Botões
    const btnMonte = document.getElementById('btnComprarMonte');
    const btnLixeira = document.getElementById('btnComprarLixeira');
    const btnDescartar = document.getElementById('btnDescartar');

    if (data.status === 'jogando' && meuTurno) {
        if (data.faseTurno === 'comprar') {
            btnMonte.removeAttribute('disabled');
            btnLixeira.removeAttribute('disabled');
            btnDescartar.setAttribute('disabled', 'true');
        } else {
            btnMonte.setAttribute('disabled', 'true');
            btnLixeira.setAttribute('disabled', 'true');
            if (selectedCardIndex !== null) {
                btnDescartar.removeAttribute('disabled');
            } else {
                btnDescartar.setAttribute('disabled', 'true');
            }
        }
    } else {
        btnMonte.setAttribute('disabled', 'true');
        btnLixeira.setAttribute('disabled', 'true');
        btnDescartar.setAttribute('disabled', 'true');
    }
}

function selecionarCarta(index, element) {
    if (!estadoJogoCache || estadoJogoCache.status !== 'jogando' || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'descartar') return;

    document.querySelectorAll('.hand .card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    selectedCardIndex = index;
    document.getElementById('btnDescartar').removeAttribute('disabled');
}

// Botão Iniciar / Reiniciar Partida (Mantém o histórico de vitórias)
document.getElementById('btnIniciarPartida')?.addEventListener('click', async () => {
    const naipes = ['♠', '♥', '♦', '♣'];
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    let baralho = [];
    naipes.forEach(naipe => {
        valores.forEach(valor => {
            baralho.push(valor + naipe);
        });
    });

    for (let i = baralho.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
    }

    const snap = await getDoc(roomRef);
    const data = snap.data();
    let jogadores = data.jogadores;

    jogadores.forEach(j => {
        j.mao = baralho.splice(0, 9);
    });

    const lixeiraInicial = [baralho.pop()];
    selectedCardIndex = null;

    await updateDoc(roomRef, {
        status: "jogando",
        faseTurno: "comprar",
        turno: jogadores[0].id,
        monte: baralho,
        lixeira: lixeiraInicial,
        jogadores: jogadores,
        vencedorNome: null
    });
});

// Comprar do Monte
document.getElementById('btnComprarMonte').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'comprar') return;

    let monte = [...estadoJogoCache.monte];
    if (monte.length === 0) {
        alert("O monte acabou!");
        return;
    }

    const cartaComprada = monte.pop();
    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);
    
    jogadorAtual.mao.push(cartaComprada);

    await updateDoc(roomRef, {
        monte: monte,
        jogadores: jogadores,
        faseTurno: 'descartar'
    });
});

// Pegar da Lixeira
document.getElementById('btnComprarLixeira').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'comprar') return;

    let lixeira = [...estadoJogoCache.lixeira];
    if (lixeira.length === 0) {
        alert("A lixeira está vazia!");
        return;
    }

    const cartaLixeira = lixeira.pop();
    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);
    
    jogadorAtual.mao.push(cartaLixeira);

    await updateDoc(roomRef, {
        lixeira: lixeira,
        jogadores: jogadores,
        faseTurno: 'descartar'
    });
});

// Descartar Carta (Se o jogador ficar sem cartas ou fechar, conta a vitória)
document.getElementById('btnDescartar').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'descartar' || selectedCardIndex === null) return;

    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);

    const cartaDescartada = jogadorAtual.mao.splice(selectedCardIndex, 1)[0];
    selectedCardIndex = null;

    let lixeira = [...estadoJogoCache.lixeira];
    lixeira.push(cartaDescartada);

    // Condição de vitória (bateu / fechou o jogo ao descartar a última carta)
    if (jogadorAtual.mao.length === 0) {
        jogadorAtual.vitorias = (jogadorAtual.vitorias || 0) + 1;
        await updateDoc(roomRef, {
            lixeira: lixeira,
            jogadores: jogadores,
            status: 'fim',
            vencedorNome: jogadorAtual.nome
        });
        return;
    }

    let currentIndex = jogadores.findIndex(j => j.id === playerId);
    let nextIndex = (currentIndex + 1) % jogadores.length;
    let proximoTurnoId = jogadores[nextIndex].id;

    await updateDoc(roomRef, {
        lixeira: lixeira,
        jogadores: jogadores,
        turno: proximoTurnoId,
        faseTurno: 'comprar'
    });
});
