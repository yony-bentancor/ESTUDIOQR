document.addEventListener('DOMContentLoaded', () => {
  const modal = document.querySelector('[data-contact-modal]');
  const openButtons = document.querySelectorAll('[data-contact-open]');
  const closeButtons = document.querySelectorAll('[data-contact-close]');

  if (!modal || !openButtons.length) return;

  let lastFocused = null;

  const openModal = () => {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('eqr-modal-open');

    const firstField = modal.querySelector('input, textarea, button');
    if (firstField) setTimeout(() => firstField.focus(), 50);
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('eqr-modal-open');
    if (lastFocused) lastFocused.focus();
  };

  openButtons.forEach(btn => btn.addEventListener('click', openModal));
  closeButtons.forEach(btn => btn.addEventListener('click', closeModal));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });
});
