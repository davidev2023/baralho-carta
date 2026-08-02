import { db } from './firebase.js';
import { collection, addDoc, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log("Service Worker registrado com sucesso!"))
            .catch(err => console.log("Erro ao registrar Service Worker:", err));
    });
}

document.getElementById('createRoomBtn').addEventListener('click', async () => {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        alert('Por favor, digite seu apelido!');
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "mesas"), {
            criador: name,
            status: "aguardando",
            turno: null,
            monte: [],
            lixeira: [],
            jogadores: [{ id: "p1", nome: name, mao: [] }]
        });

        localStorage.setItem('cacheta_playerId', 'p1');
        localStorage.setItem('cacheta_playerName', name);
        localStorage.setItem('cacheta_roomId', docRef.id);

        window.location.href = `jogo.html?room=${docRef.id}`;
    } catch (e) {
        console.error("Erro ao criar mesa: ", e);
        alert("Erro ao conectar com o Firebase. Verifique suas credenciais em js/firebase.js");
    }
});

document.getElementById('joinRoomBtn').addEventListener('click', async () => {
    const name = document.getElementById('playerName').value.trim();
    const roomId = document.getElementById('roomCode').value.trim();

    if (!name || !roomId) {
        alert('Digite seu apelido e o código da mesa!');
        return;
    }

    const roomRef = doc(db, "mesas", roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        const data = roomSnap.data();
        
        if (data.status !== "aguardando") {
            alert('Esta partida já começou!');
            return;
        }

        const jogadores = data.jogadores || [];
        
        // Verifica se o nome já existe na mesa
        const idExistente = jogadores.find(j => j.nome === name);
        let newPlayerId;

        if (idExistente) {
            newPlayerId = idExistente.id;
        } else {
            newPlayerId = `p${jogadores.length + 1}`;
            jogadores.push({ id: newPlayerId, nome: name, mao: [] });
            await updateDoc(roomRef, { jogadores });
        }

        localStorage.setItem('cacheta_playerId', newPlayerId);
        localStorage.setItem('cacheta_playerName', name);
        localStorage.setItem('cacheta_roomId', roomId);

        window.location.href = `jogo.html?room=${roomId}`;
    } else {
        alert('Mesa não encontrada!');
    }
});
