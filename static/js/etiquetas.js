async function cargarEtiquetas() {
    const res = await fetch('/etiquetas');
    const etiquetas = await res.json();
    const lista = document.getElementById('listaEtiquetas');
    lista.innerHTML = '';
    etiquetas.forEach(etiqueta => {
        const li = document.createElement('li');
        li.textContent = etiqueta.nombre;
        const btn = document.createElement('button');
        btn.textContent = '❌';
        btn.onclick = () => eliminarEtiqueta(etiqueta.id);
        li.appendChild(btn);
        lista.appendChild(li);
    });
}

async function agregarEtiqueta() {
    const input = document.getElementById('nuevaEtiqueta');
    const nombre = input.value.trim();
    if (!nombre) return;
    await fetch('/etiquetas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({"nombre": nombre})
    });
    input.value = '';
    cargarEtiquetas();
}

async function eliminarEtiqueta(id) {
    await fetch(`/etiquetas/${id}`, {method: 'DELETE'});
    cargarEtiquetas();
}

document.addEventListener('DOMContentLoaded', cargarEtiquetas);
