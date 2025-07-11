document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const form = document.getElementById('formulario');
  const resultado = document.getElementById('resultado');
  const resultTitle = document.getElementById('resultTitle');
  const resultDetails = document.getElementById('resultDetails');
  const closeResult = document.getElementById('closeResult');
  const editButton = document.getElementById('editContent');
  const textoInput = document.getElementById('texto');
  const charCount = document.getElementById('charCount');
  const umbralInput = document.getElementById('umbral');
  const valorUmbral = document.getElementById('valorUmbral');
  const imagenInput = document.getElementById('imagen');
  const uploadTrigger = document.getElementById('uploadTrigger');
  const fileName = document.getElementById('fileName');
  const imagePreview = document.getElementById('imagePreview');

  // Contador de caracteres
  textoInput.addEventListener('input', updateCharCount);
  function updateCharCount() {
    const count = textoInput.value.length;
    charCount.textContent = count;
    charCount.style.color = count > 500 ? 'red' : '';
  }

  // Actualizar valor del umbral
  umbralInput.addEventListener('input', () => {
    valorUmbral.textContent = umbralInput.value;
  });

  // Trigger personalizado para subir archivo
  uploadTrigger.addEventListener('click', () => imagenInput.click());

  // Mostrar nombre de archivo y vista previa
  imagenInput.addEventListener('change', handleImageUpload);
  function handleImageUpload() {
    if (imagenInput.files.length > 0) {
      const file = imagenInput.files[0];
      fileName.textContent = file.name;
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imagePreview.innerHTML = `<img src="${e.target.result}" alt="Vista previa">`;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    } else {
      fileName.textContent = 'Ningún archivo seleccionado';
      imagePreview.style.display = 'none';
    }
  }

  // Cerrar modal de resultado
  closeResult.addEventListener('click', () => {
    resultado.classList.remove('show');
  });

  // Editar contenido después de rechazo
  editButton.addEventListener('click', () => {
    resultado.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Enviar formulario
  form.addEventListener('submit', handleFormSubmit);
  async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validación de caracteres
    if (textoInput.value.length > 500) {
      showResult(
        'Error de validación',
        'El texto no puede exceder los 500 caracteres. Por favor, acorta tu mensaje.',
        'error'
      );
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
    submitButton.disabled = true;

    try {
      const data = new FormData(form);
      const response = await fetch('/publicar', {
        method: 'POST',
        body: data
      });

      if (!response.ok) throw new Error('Error en la respuesta del servidor');
      
      const json = await response.json();
      handleResponse(json);
    } catch (error) {
      showResult(
        'Error de conexión',
        `No se pudo conectar con el servidor. Error: ${error.message}`,
        'error'
      );
      console.error('Error:', error);
    } finally {
      submitButton.innerHTML = originalText;
      submitButton.disabled = false;
    }
  }

  function handleResponse(json) {
    if (json.publicado) {
      showResult(
        '¡Publicación aprobada!',
        'Tu contenido ha pasado todos los filtros de moderación y ha sido publicado correctamente.',
        'success'
      );
      setTimeout(() => {
        window.location.href = '/ver_publicaciones';
      }, 2000);
    } else {
      showResult(
        'Publicación rechazada',
        '',
        'error',
        json
      );
    }
  }

  function showResult(title, content, type, jsonResponse = null) {
    resultTitle.textContent = title;
    resultTitle.className = `result-${type}`;
    
    if (type === 'error' && jsonResponse) {
      resultDetails.innerHTML = generateRejectionDetails(jsonResponse);
    } else {
      resultDetails.innerHTML = content;
    }
    
    resultado.classList.add('show');
  }

  function generateRejectionDetails(json) {
    let details = `<div class="rejection-details">`;
    
    // Encabezado con motivo principal
    details += `<div class="rejection-reason">
                  <i class="fas fa-exclamation-circle"></i>
                  <span>${json.motivo || 'La publicación no cumple con nuestros estándares de contenido'}</span>
                </div>`;
    
    // Problemas con el texto
    if (!json.texto?.apto) {
      details += `<div class="rejection-section">
                    <h4><i class="fas fa-font"></i> Problemas en el texto:</h4>`;
      
      if (json.texto?.hate_speech?.length) {
        details += `<div class="rejection-item">
                      <i class="fas fa-ban"></i>
                      <div>
                        <strong>Discurso de odio detectado:</strong>
                        <p>${json.texto.hate_speech.join(', ')}</p>
                      </div>
                    </div>`;
      }
      
      if (json.texto?.context_hate?.length) {
        details += `<div class="rejection-item">
                      <i class="fas fa-comment-slash"></i>
                      <div>
                        <strong>Contexto inapropiado:</strong>
                        <p>${json.texto.context_hate.join(', ')}</p>
                      </div>
                    </div>`;
      }
      
      details += `</div>`;
    }
    
    // Problemas con la imagen
    if (!json.imagen?.apta && json.imagen?.detectadas?.length) {
      details += `<div class="rejection-section">
                    <h4><i class="fas fa-image"></i> Problemas en la imagen:</h4>
                    <div class="rejection-item">
                      <i class="fas fa-eye-slash"></i>
                      <div>
                        <strong>Elementos detectados:</strong>`;
      
      json.imagen.detectadas.forEach(item => {
        details += `<div class="detected-item">
                      ${item.label} (${Math.round(item.score * 100)}% de coincidencia)
                    </div>`;
      });
      
      details += `</div></div></div>`;
    }
    
    // Análisis completo
    details += `<div class="analysis-section">
                  <h4><i class="fas fa-search"></i> Análisis completo:</h4>
                  <div class="analysis-grid">
                    <div><strong>Sentimiento:</strong> ${json.texto?.sentiment || 'N/A'}</div>
                    <div><strong>Emoción predominante:</strong> ${json.texto?.emotion || 'N/A'}</div>
                    <div><strong>Ironía detectada:</strong> ${json.texto?.irony || 'No'}</div>
                    ${json.texto?.ner?.length ? 
                      `<div><strong>Entidades nombradas:</strong> ${json.texto.ner.map(e => e.word).join(', ')}</div>` : ''}
                  </div>
                </div>`;
    
    // Consejos para mejorar
    details += `<div class="rejection-section">
                  <h4><i class="fas fa-lightbulb"></i> Consejos para mejorar:</h4>
                  <ul class="suggestions-list">
                    <li>Evita lenguaje ofensivo o discriminatorio</li>
                    <li>Revisa que las imágenes no contengan contenido inapropiado</li>
                    <li>Prueba con un umbral de sensibilidad más bajo si crees que fue un falso positivo</li>
                  </ul>
                </div>`;
    
    details += `</div>`;
    return details;
  }

  // Inicializar contador de caracteres
  updateCharCount();
});