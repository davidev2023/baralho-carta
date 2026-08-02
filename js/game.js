import { db } from './firebase.js';
import { doc, updateDoc, onSnapshot, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

try {
    const roomId = new URLSearchParams(window.location.search).get('room') || localStorage.getItem('cacheta_roomId');
    const playerId = localStorage.getItem('cacheta_playerId') || 'p_' + Math.random().toString(36).substring(2, 7);
    localStorage.setItem('cacheta_playerId', playerId);
    
    const playerName = localStorage.getItem('cacheta_playerName') || 'Jogador';

    if (!roomId) {
        alert("Sala não encontrada!");
        window.location.href = 'index.html';
    }

    const roomRef = doc(db, "mesas", roomId);

    let gameState = null;
    let selectedCardsIndices = [];
    let indiceCartaMovendo = null;
    let saindoDaSala = false;

    const naipesSimbolos = { 'copas': '♥', 'ouros': '♦', 'espadas': '♠', 'paus': '♣' };
    const naipesCores = { 'copas': 'red', 'ouros': 'red', 'espadas': 'black', 'paus': 'black' };
    const ordemValores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    function criarBaralhoCacheta() {
        const naipes = ['copas', 'ouros', 'espadas', 'paus'];
        let deck = [];
        for (let b = 0; b < 2; b++) {
            for (let n of naipes) {
                for (let v of ordemValores) {
                    deck.push({ naipe: n, valor: v, idUnico: Math.random().toString(36).substring(2, 9) });
                }
            }
        }
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    async function entrarNaMesa() {
        const docSnap = await getDoc(roomRef);
        if (!docSnap.exists()) {
            alert("Esta mesa não existe mais.");
            window.location.href = 'index.html';
            return;
        }
        
        let data = docSnap.data();
        let jogadores = data.jogadores || [];
        let existe = jogadores.some(j => j.id === playerId);

        if (!existe) {
            jogadores.push({
                id: playerId,
                nome: playerName,
                mao: [],
                gruposBaixados: []
            });
            await updateDoc(roomRef, { jogadores: jogadores });
        }
    }

    entrarNaMesa();

    onSnapshot(roomRef, (docSnap) => {
        if (!docSnap.exists()) {
            if (!saindoDaSala) {
                alert("A sala foi encerrada porque um jogador saiu.");
                window.location.href = 'index.html';
            }
            return;
        }

        gameState = docSnap.data();

        // Se a sala foi marcada como fechada por desistência/saída
        if (gameState.status === 'desconectada') {
            alert("Um jogador saiu da partida. A sala foi fechada.");
            window.location.href = 'index.html';
            return;
        }
        
        controlarFimDeJogo();
        renderMesa();
    }, (error) => {
        console.error("Erro ao sincronizar mesa:", error);
    });

    // Função para lidar com a saída da sala (botão ou fechar aba)
    async function sairDaSala() {
        if (saindoDaSala) return;
        saindoDaSala = true;

        try {
            const docSnap = await getDoc(roomRef);
            if (docSnap.exists()) {
                let data = docSnap.data();
                let jogadoresRestantes = (data.jogadores || []).filter(j => j.id !== playerId);

                // Se era o último ou se quisermos derrubar a sala inteira quando qualquer um sair:
                if (jogadoresRestantes.length < (data.jogadores || []).length) {
                    // Atualiza avisando os demais ou apaga a sala direto
                    await updateDoc(roomRef, { status: 'desconectada', jogadores: jogadoresRestantes });
                }
            }
        } catch (e) {
            console.error("Erro ao processar saída:", e);
        }

        localStorage.removeItem('cacheta_roomId');
    }

    // Dispara ao fechar a aba ou navegador
    window.addEventListener('beforeunload', () => {
        sairDaSala();
    });

    document.getElementById('leaveBtn')?.addEventListener('click', async () => {
        await sairDaSala();
        window.location.href = 'index.html';
    });

    function controlarFimDeJogo() {
        const modal = document.getElementById('modalVitoria');
        const vencedorTexto = document.getElementById('vencedorTexto');

        if (gameState && gameState.status === 'finalizada') {
            if (modal && vencedorTexto) {
                vencedorTexto.innerText = `${gameState.vencedor} Bateu e Venceu a Partida! 🏆`;
                modal.style.display = 'flex';
            }

            if (gameState.jogadores && gameState.jogadores[0].id === playerId) {
                setTimeout(async () => {
                    let deck = criarBaralhoCacheta();
                    const vira = deck.pop();

                    let jogadoresAtuais = gameState.jogadores.map(j => ({
                        id: j.id,
                        nome: j.nome,
                        mao: [],
                        gruposBaixados: []
                    }));

                    let temBot = jogadoresAtuais.some(j => j.id.startsWith('p_bot'));
                    let jogadoresReais = jogadoresAtuais.filter(j => !j.id.startsWith('p_bot'));

                    if (jogadoresReais.length === 1 && !temBot) {
                        jogadoresAtuais.push({
                            id: 'p_bot_1',
                            nome: 'Robô 🤖',
                            mao: [],
                            gruposBaixados: []
                        });
                    }

                    jogadoresAtuais.forEach(j => {
                        j.mao = deck.splice(0, 9);
                    });

                    await updateDoc(roomRef, {
                        status: 'jogando',
                        vencedor: null,
                        monte: deck,
                        vira: vira,
                        lixeira: [],
                        turno: jogadoresAtuais[0].id,
                        faseTurno: 'comprar',
                        jogadores: jogadoresAtuais
                    });
                }, 4000);
            }
        } else {
            if (modal) modal.style.display = 'none';
        }
    }

    function obterCoringa(vira) {
        if (!vira) return '';
        const idx = ordemValores.indexOf(vira.valor);
        return ordemValores[(idx + 1) % ordemValores.length];
    }

    const roomDisplay = document.getElementById('roomDisplay');
    if (roomDisplay) {
        roomDisplay.addEventListener('click', () => {
            navigator.clipboard.writeText(roomId).then(() => {
                alert(`Código da sala "${roomId}" copiado para a área de transferência!`);
            }).catch(err => {
                console.error('Erro ao copiar:', err);
            });
        });
    }

    function renderMesa() {
        if (!gameState) return;

        try {
            if (roomDisplay) roomDisplay.innerHTML = `Mesa: ${roomId} <span style="font-size: 0.75rem;">📋 (Copiar)</span>`;

            const deckCount = document.getElementById('deckCount');
            if (deckCount) deckCount.innerText = gameState.monte ? gameState.monte.length : 0;

            const coringaStr = gameState.vira ? obterCoringa(gameState.vira) : '';

            const viraEl = document.getElementById('coringaPile');
            if (viraEl && gameState.vira) {
                viraEl.innerHTML = renderCardHTML(gameState.vira, coringaStr);
                const coringaTexto = document.getElementById('coringaTexto');
                if (coringaTexto) coringaTexto.innerText = `Coringa: ${coringaStr}`;
            }

            const discardEl = document.getElementById('discardPile');
            if (discardEl) {
                if (gameState.lixeira && gameState.lixeira.length > 0) {
                    const topoLixeira = gameState.lixeira[gameState.lixeira.length - 1];
                    discardEl.innerHTML = renderCardHTML(topoLixeira, coringaStr);
                } else {
                    discardEl.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 0.8rem; text-align:center;">Vazio</div>';
                }
            }

            const statusTurno = document.getElementById('statusTurno');
            if (statusTurno) {
                if (!gameState.status || gameState.status === 'aguardando') {
                    statusTurno.innerText = `Aguardando o administrador iniciar a partida...`;
                } else {
                    const meuTurno = gameState.turno === playerId;
                    statusTurno.innerText = meuTurno ? `Seu turno! Fase: ${gameState.faseTurno === 'comprar' ? 'Compre do Monte ou Lixeira' : 'Descarte uma carta'}` : `Turno de outro jogador...`;
                }
            }

            const adminControls = document.getElementById('adminControls');
            if (adminControls) {
                if (!gameState.status || gameState.status === 'aguardando') {
                    adminControls.style.display = 'block';
                } else {
                    adminControls.style.display = 'none';
                }
            }

            const playersArea = document.getElementById('playersArea');
            if (playersArea) {
                playersArea.innerHTML = '';
                if (gameState.jogadores) {
                    gameState.jogadores.forEach(j => {
                        const div = document.createElement('div');
                        div.style.cssText = "background: rgba(0,0,0,0.4); padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; color: #fff;";
                        let infoGrupos = j.gruposBaixados && j.gruposBaixados.length > 0 ? ` | Grupos: ${j.gruposBaixados.length}` : '';
                        div.innerHTML = `<strong>${j.nome}</strong>: ${j.mao ? j.mao.length : 0} cartas${infoGrupos}`;
                        playersArea.appendChild(div);
                    });
                }
            }

            const infoText = document.getElementById('infoReordenar');
            const btnCancelar = document.getElementById('btnCancelarMovimento');
            if (infoText && btnCancelar) {
                if (indiceCartaMovendo !== null) {
                    infoText.innerText = "Toque na carta onde deseja encaixar esta:";
                    btnCancelar.style.display = 'inline-block';
                } else {
                    infoText.innerText = "Toque para selecionar. Dê duplo clique para reorganizar";
                    btnCancelar.style.display = 'none';
                }
            }

            const eu = gameState.jogadores ? gameState.jogadores.find(j => j.id === playerId) : null;
            const handEl = document.getElementById('playerHand');
            if (handEl) {
                handEl.innerHTML = '';

                if (eu && eu.mao) {
                    eu.mao.forEach((carta, index) => {
                        const cardDiv = document.createElement('div');
                        cardDiv.className = `card ${naipesCores[carta.naipe]}`;
                        
                        if (selectedCardsIndices.includes(index)) cardDiv.classList.add('selected');

                        let grupoIndex = -1;
                        if (eu.gruposBaixados) {
                            grupoIndex = eu.gruposBaixados.findIndex(g => g.ids.includes(carta.idUnico));
                        }

                        if (grupoIndex > -1) {
                            const coresBorda = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c'];
                            cardDiv.style.borderColor = coresBorda[grupoIndex % coresBorda.length];
                            cardDiv.style.borderWidth = '3px';
                            cardDiv.style.borderStyle = 'solid';
                        } else {
                            cardDiv.style.border = 'none';
                        }

                        if (indiceCartaMovendo === index) cardDiv.classList.add('movendo-origem');
                        else if (indiceCartaMovendo !== null) cardDiv.classList.add('alvo-destino');

                        const ehCoringa = carta.valor === coringaStr;
                        cardDiv.innerHTML = `
                            ${ehCoringa ? '<span class="coringa-badge">Coringa</span>' : ''}
                            <span style="font-size: 1rem; line-height: 1;">${carta.valor}</span>
                            <span style="font-size: 1.8rem; align-self: center; line-height: 1;">${naipesSimbolos[carta.naipe]}</span>
                            <span style="font-size: 1rem; align-self: flex-end; transform: rotate(180deg); line-height: 1;">${carta.valor}</span>
                        `;

                        configurarInteracaoCarta(cardDiv, index);
                        handEl.appendChild(cardDiv);
                    });
                }
            }

            verificarTurnoRobo();
        } catch (err) {
            console.error("Erro interno na renderização:", err);
        }
    }

    function renderCardHTML(carta, coringaStr) {
        const ehCoringa = carta.valor === coringaStr;
        return `
            <div class="card ${naipesCores[carta.naipe]}" style="width: 75px; height: 110px; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 6px; background: #fff; border-radius: 8px; box-sizing: border-box; font-weight: bold;">
                ${ehCoringa ? '<span class="coringa-badge">Coringa</span>' : ''}
                <span style="font-size: 1rem; line-height: 1;">${carta.valor}</span>
                <span style="font-size: 1.8rem; align-self: center; line-height: 1;">${naipesSimbolos[carta.naipe]}</span>
                <span style="font-size: 1rem; align-self: flex-end; transform: rotate(180deg); line-height: 1;">${carta.valor}</span>
            </div>
        `;
    }

    let ultimoCliqueTempo = 0;
    let ultimoIndiceClicado = null;

    function configurarInteracaoCarta(cardDiv, indexCarta) {
        let inicioX = 0, inicioY = 0, movimentou = false;

        cardDiv.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0]) {
                inicioX = e.touches[0].clientX;
                inicioY = e.touches[0].clientY;
                movimentou = false;
            }
        }, { passive: true });

        cardDiv.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches[0]) {
                if (Math.abs(e.touches[0].clientX - inicioX) > 6 || Math.abs(e.touches[0].clientY - inicioY) > 6) {
                    movimentou = true;
                }
            }
        }, { passive: true });

        cardDiv.addEventListener('touchend', async (e) => {
            if (!movimentou) {
                e.preventDefault();
                await acaoCliqueCarta(indexCarta);
            }
        });

        cardDiv.addEventListener('click', async () => {
            await acaoCliqueCarta(indexCarta);
        });
    }

    async function acaoCliqueCarta(indexCarta) {
        const agora = new Date().getTime();
        if (agora - ultimoCliqueTempo < 350 && ultimoIndiceClicado === indexCarta) {
            indiceCartaMovendo = indexCarta;
            ultimoCliqueTempo = 0;
            ultimoIndiceClicado = null;
            renderMesa();
            return;
        }
        ultimoCliqueTempo = agora;
        ultimoIndiceClicado = indexCarta;

        let eu = gameState.jogadores.find(j => j.id === playerId);

        if (indiceCartaMovendo === null) {
            const pos = selectedCardsIndices.indexOf(indexCarta);
            if (pos > -1) {
                selectedCardsIndices.splice(pos, 1);
            } else {
                selectedCardsIndices.push(indexCarta);
            }
            renderMesa();
        } else {
            if (indiceCartaMovendo === indexCarta) {
                indiceCartaMovendo = null;
                renderMesa();
                return;
            }
            let [cartaMovida] = eu.mao.splice(indiceCartaMovendo, 1);
            let novoDestino = indexCarta;
            if (indiceCartaMovendo < indexCarta) novoDestino--;
            eu.mao.splice(novoDestino, 0, cartaMovida);

            indiceCartaMovendo = null;
            selectedCardsIndices = [novoDestino];
            await updateDoc(roomRef, { jogadores: gameState.jogadores });
        }
    }

    document.getElementById('btnCancelarMovimento')?.addEventListener('click', () => {
        indiceCartaMovendo = null;
        renderMesa();
    });

    document.getElementById('btnIniciarPartida')?.addEventListener('click', async () => {
        let deck = criarBaralhoCacheta();
        const vira = deck.pop();

        let jogadoresAtuais = gameState.jogadores ? [...gameState.jogadores] : [];
        if (jogadoresAtuais.length === 0) {
            jogadoresAtuais.push({ id: playerId, nome: playerName, mao: [], gruposBaixados: [] });
        }

        let temBot = jogadoresAtuais.some(j => j.id.startsWith('p_bot'));
        let jogadoresReais = jogadoresAtuais.filter(j => !j.id.startsWith('p_bot'));

        if (jogadoresReais.length === 1 && !temBot) {
            jogadoresAtuais.push({
                id: 'p_bot_1',
                nome: 'Robô 🤖',
                mao: [],
                gruposBaixados: []
            });
        } else if (jogadoresReais.length > 1 && temBot) {
            jogadoresAtuais = jogadoresAtuais.filter(j => !j.id.startsWith('p_bot'));
        }

        jogadoresAtuais.forEach(j => {
            j.gruposBaixados = [];
            j.mao = deck.splice(0, 9);
        });

        await updateDoc(roomRef, {
            status: 'jogando',
            vencedor: null,
            monte: deck,
            vira: vira,
            lixeira: [],
            turno: jogadoresAtuais[0].id,
            faseTurno: 'comprar',
            jogadores: jogadoresAtuais
        });
    });

    document.getElementById('btnComprarMonte')?.addEventListener('click', async () => {
        if (!validarTurnoEFase('comprar')) return;
        if (!gameState.monte || gameState.monte.length === 0) {
            alert("O monte está vazio!");
            return;
        }

        let monte = [...gameState.monte];
        let cartaComprada = monte.pop();
        let eu = gameState.jogadores.find(j => j.id === playerId);
        eu.mao.push(cartaComprada);

        await updateDoc(roomRef, {
            monte: monte,
            jogadores: gameState.jogadores,
            faseTurno: 'descartar'
        });
    });

    document.getElementById('discardPile')?.addEventListener('click', async () => {
        if (!gameState || gameState.status !== 'jogando') return;
        if (!validarTurnoEFase('comprar')) return;
        if (!gameState.lixeira || gameState.lixeira.length === 0) {
            alert("A lixeira está vazia!");
            return;
        }

        let lixeira = [...gameState.lixeira];
        let cartaComprada = lixeira.pop();
        let eu = gameState.jogadores.find(j => j.id === playerId);
        eu.mao.push(cartaComprada);

        await updateDoc(roomRef, {
            lixeira: lixeira,
            jogadores: gameState.jogadores,
            faseTurno: 'descartar'
        });
    });

    function validarTurnoEFase(faseEsperada) {
        if (!gameState.status || gameState.status !== 'jogando') {
            alert("A partida ainda não começou!");
            return false;
        }
        if (gameState.turno !== playerId) {
            alert("Não é o seu turno!");
            return false;
        }
        if (gameState.faseTurno !== faseEsperada) {
            if (faseEsperada === 'comprar') alert("Você já comprou carta neste turno. Descarte uma carta!");
            else alert("Você precisa comprar uma carta antes de descartar!");
            return false;
        }
        return true;
    }

    function validarGrupo(cartas, coringaStr) {
        if (cartas.length < 3) return false;

        let totalCoringas = cartas.filter(c => c.valor === coringaStr).length;
        let cartasNormais = cartas.filter(c => c.valor !== coringaStr);

        if (cartasNormais.length === 0) return true;

        let primeiroValorNormal = cartasNormais[0].valor;
        let ehTrincaPotencial = cartasNormais.every(c => c.valor === primeiroValorNormal);
        if (ehTrincaPotencial) return true;

        let naipeRef = cartasNormais[0].naipe;
        let mesmoNaipe = cartasNormais.every(c => c.naipe === naipeRef);
        if (!mesmoNaipe) return false;

        let indices = cartasNormais.map(c => ordemValores.indexOf(c.valor)).sort((a, b) => a - b);
        
        let buracos = 0;
        for (let i = 0; i < indices.length - 1; i++) {
            let diff = indices[i+1] - indices[i];
            if (diff === 0) return false;
            buracos += (diff - 1);
        }

        return totalCoringas >= buracos;
    }

    document.getElementById('btnMarcarGrupo')?.addEventListener('click', async () => {
        if (selectedCardsIndices.length < 3) {
            alert("Selecione pelo menos 3 cartas para marcar um grupo!");
            return;
        }

        let eu = gameState.jogadores.find(j => j.id === playerId);
        let coringaStr = gameState.vira ? obterCoringa(gameState.vira) : '';

        let cartasSelecionadas = selectedCardsIndices.map(idx => eu.mao[idx]);

        if (!validarGrupo(cartasSelecionadas, coringaStr)) {
            alert("Este grupo é inválido! Verifique trincas ou sequências.");
            return;
        }

        if (!eu.gruposBaixados) eu.gruposBaixados = [];
        
        let idsUnicosGrupo = cartasSelecionadas.map(c => c.idUnico);
        eu.gruposBaixados.push({ ids: idsUnicosGrupo });

        selectedCardsIndices = [];
        await updateDoc(roomRef, { jogadores: gameState.jogadores });
        alert("Grupo marcado com sucesso!");
    });

    document.getElementById('btnBater')?.addEventListener('click', async () => {
        if (!gameState || gameState.status !== 'jogando') return;
        if (gameState.turno !== playerId) {
            alert("Não é o seu turno!");
            return;
        }

        let eu = gameState.jogadores.find(j => j.id === playerId);
        
        if (!eu.gruposBaixados || eu.gruposBaixados.length === 0) {
            alert("Você precisa marcar seus grupos antes de bater!");
            return;
        }

        let idsAgrupados = [];
        eu.gruposBaixados.forEach(g => { idsAgrupados.push(...g.ids); });

        let cartasForaDosGrupos = eu.mao.filter(c => !idsAgrupados.includes(c.idUnico));

        if (cartasForaDosGrupos.length > 1) {
            alert("Para bater, todas as suas cartas precisam estar agrupadas (exceto o descarte final).");
            return;
        }

        await updateDoc(roomRef, {
            status: 'finalizada',
            vencedor: playerName
        });
    });

    document.getElementById('btnDescartar')?.addEventListener('click', async () => {
        if (!gameState || gameState.status !== 'jogando') return;
        if (!validarTurnoEFase('descartar')) return;
        if (selectedCardsIndices.length !== 1) {
            alert("Selecione exatamente 1 carta para descartar!");
            return;
        }

        let indiceDescarte = selectedCardsIndices[0];
        let eu = gameState.jogadores.find(j => j.id === playerId);
        let cartaDescartada = eu.mao[indiceDescarte];

        if (eu.gruposBaixados) {
            eu.gruposBaixados = eu.gruposBaixados.map(g => {
                g.ids = g.ids.filter(id => id !== cartaDescartada.idUnico);
                return g;
            }).filter(g => g.ids.length >= 3);
        }

        eu.mao.splice(indiceDescarte, 1);
        
        if (!gameState.lixeira) gameState.lixeira = [];
        gameState.lixeira.push(cartaDescartada);
        selectedCardsIndices = [];

        let idxAtual = gameState.jogadores.findIndex(j => j.id === playerId);
        let proximoIdx = (idxAtual + 1) % gameState.jogadores.length;

        await updateDoc(roomRef, {
            lixeira: gameState.lixeira,
            jogadores: gameState.jogadores,
            turno: gameState.jogadores[proximoIdx].id,
            faseTurno: 'comprar'
        });
    });

    function verificarTurnoRobo() {
        if (!gameState || gameState.status !== 'jogando') return;
        const jogadorAtual = gameState.jogadores.find(j => j.id === gameState.turno);
        
        if (jogadorAtual && jogadorAtual.id.startsWith('p_bot')) {
            setTimeout(async () => {
                if (gameState.turno !== jogadorAtual.id) return;
                let monte = [...gameState.monte];
                if (monte.length === 0) return;

                let carta = monte.pop();
                jogadorAtual.mao.push(carta);

                let cartaDescartada = jogadorAtual.mao.pop();
                if (!gameState.lixeira) gameState.lixeira = [];
                gameState.lixeira.push(cartaDescartada);

                let idxAtual = gameState.jogadores.findIndex(j => j.id === jogadorAtual.id);
                let proximoIdx = (idxAtual + 1) % gameState.jogadores.length;

                await updateDoc(roomRef, {
                    monte: monte,
                    lixeira: gameState.lixeira,
                    jogadores: gameState.jogadores,
                    turno: gameState.jogadores[proximoIdx].id,
                    faseTurno: 'comprar'
                });
            }, 1500);
        }
    }

} catch (globalError) {
    console.error("Erro crítico na inicialização do jogo:", globalError);
    document.body.innerHTML = `<div style="color:white; text-align:center; padding:50px; font-family:sans-serif;"><h2>Ops! Ocorreu um erro ao carregar o jogo.</h2><button onclick="localStorage.clear(); window.location.href='index.html';" style="padding:10px 20px; background:#e74c3c; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; margin-top:20px;">Reiniciar Jogo</button></div>`;
}
