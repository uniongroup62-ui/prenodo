(function () {
  document.querySelectorAll('[data-pos-success-print]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        window.print();
      } catch (e) {
      }
    });
  });
})();
