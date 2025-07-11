document.addEventListener('DOMContentLoaded', async () => {
  const contenedor = document.getElementById("contenedor");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const dateFilter = document.getElementById("dateFilter");
  
  let publicaciones = [];
  
  // Cargar publicaciones
  async function cargarPublicaciones() {
    try {
      contenedor.innerHTML = `
        <div class="skeleton-loading">
          <div class="skeleton-header"></div>
          <div class="skeleton-content"></div>
          <div class="skeleton-image"></div>
        </div>
        <div class="skeleton-loading">
          <div class="skeleton-header"></div>
          <div class="skeleton-content"></div>
        </div>
      `;
      
      const res = await fetch("/publicaciones");
      publicaciones = await res.json();
      
      mostrarPublicaciones(publicaciones);
      
      if (publicaciones.length === 0) {
        emptyState.classList.remove('hidden');
        contenedor.classList.add('hidden');
      } else {
        emptyState.classList.add('hidden');
        contenedor.classList.remove('hidden');
      }
    } catch (err) {
      contenedor.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Error al cargar publicaciones</h3>
          <p>Por favor, intenta nuevamente más tarde.</p>
          <button id="reloadButton" class="cta-button">
            <i class="fas fa-sync-alt"></i> Reintentar
          </button>
        </div>
      `;
      
      document.getElementById('reloadButton').addEventListener('click', cargarPublicaciones);
      console.error(err);
    }
  }
  
  // Mostrar publicaciones en el DOM
  function mostrarPublicaciones(pubs) {
    contenedor.innerHTML = '';
    
    pubs.reverse().forEach(pub => {
      const div = document.createElement("div");
      div.className = "publicacion";
      
      const fecha = new Date(pub.fecha);
      const fechaFormateada = fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      let html = `
        <div class="publicacion-header">
          <span><i class="far fa-calendar-alt"></i> ${fechaFormateada}</span>
          <span><i class="far fa-clock"></i> ${fecha.toLocaleTimeString()}</span>
        </div>
        <div class="publicacion-texto">${pub.texto}</div>
      `;
      
      if (pub.url_imagen) {
        html += `
          <div class="publicacion-imagen">
            <img src="${pub.url_imagen}" alt="Imagen de la publicación" loading="lazy">
          </div>
        `;
      }
      
      div.innerHTML = html;
      contenedor.appendChild(div);
    });
  }
  
  // Filtrar publicaciones
  function filtrarPublicaciones() {
    const searchTerm = searchInput.value.toLowerCase();
    const dateFilterValue = dateFilter.value;
    
    let pubsFiltradas = publicaciones.filter(pub => {
      const textoMatch = pub.texto.toLowerCase().includes(searchTerm);
      const fechaPub = new Date(pub.fecha);
      const hoy = new Date();
      
      let fechaMatch = true;
      
      if (dateFilterValue === 'today') {
        fechaMatch = fechaPub.toDateString() === hoy.toDateString();
      } else if (dateFilterValue === 'week') {
        const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
        fechaMatch = fechaPub >= inicioSemana;
      } else if (dateFilterValue === 'month') {
        fechaMatch = fechaPub.getMonth() === hoy.getMonth() && 
                     fechaPub.getFullYear() === hoy.getFullYear();
      }
      
      return textoMatch && fechaMatch;
    });
    
    mostrarPublicaciones(pubsFiltradas);
    
    if (pubsFiltradas.length === 0) {
      emptyState.classList.remove('hidden');
      contenedor.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      contenedor.classList.remove('hidden');
    }
  }
  
  // Event listeners
  searchInput.addEventListener('input', filtrarPublicaciones);
  dateFilter.addEventListener('change', filtrarPublicaciones);
  
  // Cargar publicaciones iniciales
  await cargarPublicaciones();
});