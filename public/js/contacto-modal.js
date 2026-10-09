document.addEventListener('DOMContentLoaded', () => {
  const modal = document.querySelector('[data-contact-modal]');
  const openButtons = document.querySelectorAll('[data-contact-open]');

  if (!modal || !openButtons.length) return;

  const form = modal.querySelector('[data-contact-form]');
  const estado = modal.querySelector('[data-contact-status]');
  const listo = modal.querySelector('[data-contact-done]');
  let lastFocused = null;

  const mostrarFormulario = () => {
    if (!form || !listo) return;
    form.hidden = false;
    listo.hidden = true;
  };

  const mostrarListo = () => {
    if (!form || !listo) return;
    form.reset();
    form.hidden = true;
    listo.hidden = false;
    const cerrar = listo.querySelector('button');
    if (cerrar) setTimeout(() => cerrar.focus(), 50);
  };

  const avisar = (texto, error) => {
    if (!estado) return;
    estado.textContent = texto || '';
    estado.classList.toggle('is-error', Boolean(error));
  };

  const openModal = () => {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('eqr-modal-open');

    const firstField = modal.querySelector('input:not([tabindex="-1"]), textarea, button');
    if (firstField && (!listo || listo.hidden)) setTimeout(() => firstField.focus(), 50);
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('eqr-modal-open');
    if (listo && !listo.hidden) { mostrarFormulario(); avisar(''); }
    if (lastFocused) lastFocused.focus();
  };

  openButtons.forEach(btn => btn.addEventListener('click', openModal));
  // Delegado: también cierra con el botón de la confirmación.
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-contact-close]')) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Validación propia (el formulario usa novalidate para mostrar mensajes en español).
      let primerError = null;
      form.querySelectorAll('.eqr-field').forEach((campo) => {
        const input = campo.querySelector('input, textarea');
        const valido = input.checkValidity() && input.value.trim() !== '';
        campo.classList.toggle('is-invalid', !valido);
        if (!valido && !primerError) primerError = input;
      });
      if (primerError) {
        avisar(primerError.type === 'email' && primerError.value.trim()
          ? 'Revisá el email: parece que no está completo.'
          : 'Completá tu nombre, tu email y tu mensaje.', true);
        primerError.focus();
        return;
      }

      const boton = form.querySelector('button[type="submit"]');
      if (boton) boton.disabled = true;
      avisar('Enviando…');

      try {
        const respuesta = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams(new FormData(form))
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (respuesta.ok && datos.ok) {
          avisar('');
          mostrarListo();
        } else {
          avisar(datos.mensaje || 'No pudimos enviar tu mensaje. Probá de nuevo en unos minutos.', true);
        }
      } catch (e) {
        avisar('No hay conexión. Revisá internet y probá de nuevo.', true);
      } finally {
        if (boton) boton.disabled = false;
      }
    });

    form.addEventListener('input', (event) => {
      const campo = event.target.closest('.eqr-field');
      if (campo) campo.classList.remove('is-invalid');
    });
  }

  // Sin JavaScript el formulario vuelve con ?contacto=ok o ?contacto=error.
  const resultado = new URLSearchParams(location.search).get('contacto');
  if (resultado) {
    openModal();
    if (resultado === 'ok') mostrarListo();
    else avisar('No pudimos enviar tu mensaje. Probá de nuevo en unos minutos.', true);
    history.replaceState(null, '', location.pathname + location.hash);
  }
});
