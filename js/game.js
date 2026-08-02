import { db } from './firebase.js';
import { doc, onSnapshot, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const playerId = localStorage.getItem('cacheta_playerId');

if (!roomId || !playerId) {
    window.location.href = 'index.html';
}

document.getElementById('roomDisplay').innerText = `Mesa: ${roomId}`;

let selectedCardIndex = null;
let estadoJogoCache = null;

const roomRef = doc(db, "mesas", roomId);

onSnapshot(roomRef, (docSnap) => {
    if (docSnap.exists()) {
        estadoJogoCache = docSnap.data();
        
        if (estadoJogoCache.status === 'jogando' && estadoJogoCache.jogadores.length < 2) {
            alert("Um jogador saiu da partida. O jogo foi encerrado!");
            window.location.href = 'index.html';
            return;
        }

        atualizarInterface(estadoJogoCache);
    }
});

document.getElementById('leaveBtn').addEventListener('click', async () => {
    if (estadoJogoCache && estadoJogoCache.jogadores) {
        let novosJogadores = estadoJogoCache.jogadores.filter(j => j.id !== playerId);
        await updateDoc(roomRef, {
            jogadores: novosJogadores,
            status: novosJogadores.length < 2 ? 'fim' : estadoJogoCache.status
        });
    }
    window.location.href = 'index.html';
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

function obterCoringa(cartaVira) {
    if (!cartaVira) return "-";
    const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let valorVira = cartaVira.slice(0, -1);
    let index = valores.indexOf(valorVira);
    let indexProximo = (index + 1) % valores.length;
    return valores[indexProximo];
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
        statusTurno.innerText = `🏆 Fim de jogo! ${data.vencedorNome || 'Partida encerrada'} venceu!`;
    } else if (meuTurno) {
        statusTurno.innerText = (data.faseTurno === 'comprar') ? "Sua vez! Compre do monte ou da lixeira." : "Sua vez! Arraste para encaixar, selecione para descartar ou bata.";
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

    // Mão do Jogador com Animação Lenta e Realista ao Soltar
    const meuObjeto = data.jogadores.find(p => p.id === playerId);
    if (meuObjeto && meuObjeto.mao) {
        const handDiv = document.getElementById('playerHand');
        handDiv.innerHTML = '';
        
        if (!meuObjeto.marcadas) meuObjeto.marcadas = [];

        meuObjeto.mao.forEach((carta, index) => {
            const cardEl = criarElementoCarta(carta);
            
            if (meuObjeto.marcadas.includes(index)) {
                cardEl.classList.add('grupo-salvo');
            }

            if (index === selectedCardIndex) {
                cardEl.classList.add('selected');
            }

            cardEl.onclick = (e) => {
                e.stopPropagation();
                if (selectedCardIndex === index) {
                    selectedCardIndex = null;
                } else {
                    selectedCardIndex = index;
                }
                atualizarInterface(estadoJogoCache);
            };

            let startX = 0;
            let startY = 0;
            let isDragging = false;
            let ultimoTargetIndex = index;

            cardEl.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isDragging = false;
                cardEl.style.zIndex = 1000;
            }, { passive: true });

            cardEl.addEventListener('touchmove', (e) => {
                let currentX = e.touches[0].clientX;
                let currentY = e.touches[0].clientY;
                let diffX = currentX - startX;
                let diffY = currentY - startY;
                
                if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
                    isDragging = true;
                    cardEl.style.transform = `translate(${diffX}px, ${diffY}px) scale(1.12)`;
                    cardEl.style.boxShadow = '0 20px 35px rgba(0,0,0,0.6)';
                    cardEl.style.transition = 'none';

                    let allCards = Array.from(handDiv.children);
                    let targetIndex = -1;
                    let menorDistancia = Infinity;

                    allCards.forEach((cEl, idx) => {
                        if (idx === index) return;
                        let rect = cEl.getBoundingClientRect();
                        let centroX = rect.left + rect.width / 2;
                        let centroY = rect.top + rect.height / 2;
                        let distancia = Math.hypot(currentX - centroX, currentY - centroY);

                        if (distancia < menorDistancia) {
                            menorDistancia = distancia;
                            targetIndex = idx;
                        }
                    });

                    if (targetIndex !== -1) {
                        ultimoTargetIndex = targetIndex;
                    }

                    allCards.forEach((cEl, idx) => {
                        if (idx === index) return;
                        // Transição mais suave e orgânica ao abrir espaço
                        cEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
                        if (targetIndex !== -1) {
                            if (index < targetIndex && idx > index && idx <= targetIndex) {
                                cEl.style.transform = index < targetIndex ? 'translateX(-35px)' : 'translateX(35px)';
                            } else if (index > targetIndex && idx >= targetIndex && idx < index) {
                                cEl.style.transform = 'translateX(35px)';
                            } else {
                                cEl.style.transform = 'translate(0, 0)';
                            }
                        }
                    });
                }
            }, { passive: true });

            cardEl.addEventListener('touchend', async () => {
                Array.from(handDiv.children).forEach(cEl => {
                    cEl.style.transform = '';
                    cEl.style.transition = '';
                });

                if (isDragging) {
                    let targetIndex = ultimoTargetIndex;

                    if (targetIndex > -1 && targetIndex !== index) {
                        // Animação desacelerada e fluida imitando a realidade (dura 0.55 segundos)
                        cardEl.style.transition = 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.55s ease';
                        cardEl.style.transform = 'translate(0, 0) scale(1.02)';
                        cardEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';

                        // Aguarda a animação lenta terminar antes de atualizar os dados no Firebase
                        await new Promise(resolve => setTimeout(resolve, 520));

                        let maoTemp = [...meuObjeto.mao];
                        let cartaMovida = maoTemp.splice(index, 1)[0];
                        
                        if (index < targetIndex) {
                            targetIndex--; 
                        }
                        
                        maoTemp.splice(targetIndex, 0, cartaMovida);

                        let marcadasTemp = [];
                        meuObjeto.marcadas.forEach(mi => {
                            if (mi === index) {
                                marcadasTemp.push(targetIndex);
                            } else {
                                let novoMi = mi;
                                if (mi > index) novoMi--;
                                if (novoMi >= targetIndex) novoMi++;
                                marcadasTemp.push(novoMi);
                            }
                        });

                        meuObjeto.mao = maoTemp;
                        meuObjeto.marcadas = [...new Set(marcadasTemp)];
                        selectedCardIndex = null;

                        await salvarMaoEOrdenacao(meuObjeto.mao, meuObjeto.marcadas);
                    } else {
                        cardEl.style.zIndex = 1;
                        cardEl.style.transform = '';
                        cardEl.style.boxShadow = '';
                    }
                }
            });

            handDiv.appendChild(cardEl);
        });
    }

    // Botões
    const btnMonte = document.getElementById('btnComprarMonte');
    const btnLixeira = document.getElementById('btnComprarLixeira');
    const btnDescartar = document.getElementById('btnDescartar');
    const btnBater = document.getElementById('btnBater');
    const btnMarcar = document.getElementById('btnMarcarGrupo');

    if (data.status === 'jogando' && meuTurno) {
        btnMarcar.style.display = 'inline-block';
        btnMarcar.removeAttribute('disabled');

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
        btnMarcar.style.display = 'none';
    }
}

async function salvarMaoEOrdenacao(novaMao, novasMarcadas) {
    let jogadores = [...estadoJogoCache.jogadores];
    let jIndex = jogadores.findIndex(j => j.id === playerId);
    jogadores[jIndex] = { ...jogadores[jIndex], mao: novaMao, marcadas: novasMarcadas };
    await updateDoc(roomRef, { jogadores });
}

document.getElementById('btnMarcarGrupo')?.addEventListener('click', async () => {
    if (selectedCardIndex === null || !estadoJogoCache) return;

    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);
    if (!jogadorAtual.marcadas) jogadorAtual.marcadas = [];

    const pos = jogadorAtual.marcadas.indexOf(selectedCardIndex);
    if (pos > -1) {
        jogadorAtual.marcadas.splice(pos, 1);
    } else {
        jogadorAtual.marcadas.push(selectedCardIndex);
    }

    selectedCardIndex = null;
    await updateDoc(roomRef, { jogadores });
});

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
        j.mao = baralho.splice(0, 9);
        j.marcadas = [];
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

document.getElementById('btnDescartar').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || estadoJogoCache.faseTurno !== 'descartar' || selectedCardIndex === null) return;

    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);

    if (jogadorAtual.mao.length !== 10) {
        alert("Você precisa comprar uma carta antes de descartar!");
        return;
    }

    const cartaDescartada = jogadorAtual.mao.splice(selectedCardIndex, 1)[0];
    
    if (jogadorAtual.marcadas) {
        jogadorAtual.marcadas = jogadorAtual.marcadas
            .filter(idx => idx !== selectedCardIndex)
            .map(idx => idx > selectedCardIndex ? idx - 1 : idx);
    }

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

document.getElementById('btnBater').addEventListener('click', async () => {
    if (!estadoJogoCache || estadoJogoCache.turno !== playerId || selectedCardIndex === null) return;

    let jogadores = [...estadoJogoCache.jogadores];
    let jogadorAtual = jogadores.find(j => j.id === playerId);

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
