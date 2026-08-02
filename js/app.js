import { db } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('createRoomBtn')?.addEventListener('click', async () => {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert("Digite seu apelido antes de criar a mesa!");
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "mesas"), {
            criador: playerName,
            status: 'aguardando',
            jogadores: [
                { id: 'p1', nome: playerName, mao: [] },
                { id: 'p_bot_1', nome: 'Robô Ágil', mao: [] }
            ],
            turno: 'p1',
            faseTurno: 'comprar',
            monte: [],
            lixeira: [],
            vira: null
        });

        localStorage.setItem('cacheta_roomId', docRef.id);
        localStorage.setItem('cacheta_playerId', 'p1');
        localStorage.setItem('cacheta_playerName', playerName);

        window.location.href = `jogo.html?room=${docRef.id}`;
    } catch (e) {
        console.error("Erro ao criar mesa: ", e);
        alert("Erro ao criar mesa. Verifique sua conexão com o Firebase.");
    }
});

document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim();

    if (!playerName || !roomCode) {
        alert("Preencha seu apelido e o código da mesa!");
        return;
    }

    localStorage.setItem('cacheta_roomId', roomCode);
    localStorage.setItem('cacheta_playerId', 'p2');
    localStorage.setItem('cacheta_playerName', playerName);

    window.location.href = `jogo.html?room=${roomCode}`;
});
