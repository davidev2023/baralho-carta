document.addEventListener('DOMContentLoaded', () => {
    const inputNome = document.getElementById('inputNome');
    const inputCodigoSala = document.getElementById('inputCodigoSala');
    const btnCriar = document.getElementById('btnCriarSala');
    const btnEntrar = document.getElementById('btnEntrarSala');

    let idUsuario = sessionStorage.getItem('cacheta_user_id');
    if (!idUsuario) {
        idUsuario = 'user_' + Math.floor(Math.random() * 100000);
        sessionStorage.setItem('cacheta_user_id', idUsuario);
    }

    if (btnCriar) {
        btnCriar.addEventListener('click', () => {
            const nome = inputNome ? inputNome.value.trim() : "";
            if (!nome) {
                alert("Por favor, digite seu nome!");
                if (inputNome) inputNome.focus();
                return;
            }

            sessionStorage.setItem('cacheta_user_name', nome);
            const novoIdSala = 'SALA_' + Math.floor(1000 + Math.random() * 9000);
            sessionStorage.setItem('cacheta_sala_id', novoIdSala);

            window.location.href = `jogo.html?sala=${novoIdSala}`;
        });
    }

    if (btnEntrar) {
        btnEntrar.addEventListener('click', () => {
            const nome = inputNome ? inputNome.value.trim() : "";
            const codigoSala = inputCodigoSala ? inputCodigoSala.value.trim().toUpperCase() : "";

            if (!nome) {
                alert("Por favor, digite seu nome!");
                if (inputNome) inputNome.focus();
                return;
            }
            if (!codigoSala) {
                alert("Por favor, digite o código da mesa!");
                if (inputCodigoSala) inputCodigoSala.focus();
                return;
            }

            sessionStorage.setItem('cacheta_user_name', nome);
            sessionStorage.setItem('cacheta_sala_id', codigoSala);

            window.location.href = `jogo.html?sala=${codigoSala}`;
        });
    }
});
