function publicMarketplaceReadJsonConfig(id) {
  const el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

const PUBLIC_MARKETPLACE_CONFIG = publicMarketplaceReadJsonConfig('publicMarketplaceConfig');

    (function(){
      const positionPattern = /^\d{1,3}%\s+\d{1,3}%$/;
      document.querySelectorAll('[data-object-position]').forEach(image => {
        const position = String(image.getAttribute('data-object-position') || '').trim();
        if (positionPattern.test(position)) image.style.objectPosition = position;
      });

      document.querySelectorAll('[data-city-image]').forEach(card => {
        const image = String(card.getAttribute('data-city-image') || '').trim();
        if (!image) return;
        const escapedImage = image.replace(/["\\\n\r\f]/g, '\\$&');
        card.style.setProperty('--city-image', 'url("' + escapedImage + '")');
      });
    })();

    (function(){
      const modal = document.getElementById('marketplaceFiltersModal');
      if (!modal) return;
      const openers = Array.from(document.querySelectorAll('[data-marketplace-filters-open]'));
      const closers = Array.from(modal.querySelectorAll('[data-marketplace-filters-close]'));
      let lastFocus = null;

      function openFilters() {
        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('marketplace-filters-open');
        const firstField = modal.querySelector('.filter-card input, .filter-card select, .filter-modal__close');
        if (firstField instanceof HTMLElement) firstField.focus();
      }

      function closeFilters() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('marketplace-filters-open');
        if (lastFocus instanceof HTMLElement) lastFocus.focus();
      }

      openers.forEach(button => button.addEventListener('click', openFilters));
      closers.forEach(button => button.addEventListener('click', closeFilters));
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) closeFilters();
      });
    })();

    (function(){
      const endpoint = String(PUBLIC_MARKETPLACE_CONFIG.favoriteEndpointUrl || '');
      const fallbackLogin = String(PUBLIC_MARKETPLACE_CONFIG.accountLoginUrl || '');
      const buttons = Array.from(document.querySelectorAll('[data-favorite-button]'));
      if (!buttons.length) return;

      function setButton(button, active) {
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.setAttribute('aria-label', active ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti');
      }

      function setKey(key, active) {
        if (!key) return;
        buttons.forEach(button => {
          if ((button.dataset.favoriteKey || '') === key) setButton(button, active);
        });
      }

      buttons.forEach(button => {
        button.addEventListener('click', async event => {
          event.preventDefault();
          event.stopPropagation();
          if (button.classList.contains('is-loading')) return;
          button.classList.add('is-loading');
          try {
            const form = new FormData();
            form.append('action', 'toggle_favorite');
            form.append('tenant_slug', button.dataset.tenantSlug || '');
            form.append('location_id', button.dataset.locationId || '0');
            form.append('location_slug', button.dataset.locationSlug || '');
            const response = await fetch(endpoint, {
              method: 'POST',
              body: form,
              credentials: 'same-origin'
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
              window.location.href = data.login_url || fallbackLogin;
              return;
            }
            if (!response.ok || !data.ok) throw new Error(data.error || 'Errore preferiti');
            setKey(data.key || button.dataset.favoriteKey || '', !!data.active);
          } catch (error) {
            console.error(error);
          } finally {
            button.classList.remove('is-loading');
          }
        });
      });
    })();

    (function(){
      const buttons = Array.from(document.querySelectorAll('[data-share-button]'));
      if (!buttons.length) return;

      async function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } finally {
          textarea.remove();
        }
      }

      function markCopied(button) {
        const previousLabel = button.getAttribute('aria-label') || 'Condividi scheda';
        button.classList.add('is-copied');
        button.setAttribute('aria-label', 'Link copiato');
        window.setTimeout(() => {
          button.classList.remove('is-copied');
          button.setAttribute('aria-label', previousLabel);
        }, 1600);
      }

      buttons.forEach(button => {
        button.addEventListener('click', async event => {
          event.preventDefault();
          event.stopPropagation();
          const url = button.dataset.shareUrl || window.location.href;
          const shareData = {
            title: button.dataset.shareTitle || document.title,
            text: button.dataset.shareText || '',
            url
          };

          try {
            if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
              await navigator.share(shareData);
              return;
            }
            await copyText(url);
            markCopied(button);
          } catch (error) {
            if (error && error.name === 'AbortError') return;
            try {
              await copyText(url);
              markCopied(button);
            } catch (copyError) {
              console.error(copyError);
            }
          }
        });
      });
    })();

    (function(){
      const modal = document.getElementById('salonGalleryModal');
      if (!modal) return;
      const openers = Array.from(document.querySelectorAll('[data-salon-gallery-open]'));
      const closers = Array.from(modal.querySelectorAll('[data-salon-gallery-close]'));
      let lastFocus = null;

      function openGallery() {
        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('salon-gallery-modal-open');
        const closeButton = modal.querySelector('.salon-gallery-modal__close');
        if (closeButton instanceof HTMLElement) closeButton.focus();
      }

      function closeGallery() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('salon-gallery-modal-open');
        if (lastFocus) lastFocus.focus();
      }

      openers.forEach(button => {
        button.addEventListener('click', openGallery);
      });
      closers.forEach(button => {
        button.addEventListener('click', closeGallery);
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) closeGallery();
      });
    })();

    (function(){
      function wireSalonModal(modalId, openSelector, closeSelector, bodyClass){
        const modal = document.getElementById(modalId);
        if (!modal) return;
        const openers = Array.from(document.querySelectorAll(openSelector));
        const closers = Array.from(modal.querySelectorAll(closeSelector));
        let lastFocus = null;

        function openModal(){
          lastFocus = document.activeElement;
          modal.classList.add('is-open');
          modal.setAttribute('aria-hidden', 'false');
          document.body.classList.add(bodyClass);
          const closeButton = modal.querySelector(closeSelector);
          if (closeButton) closeButton.focus();
        }

        function closeModal(){
          modal.classList.remove('is-open');
          modal.setAttribute('aria-hidden', 'true');
          document.body.classList.remove(bodyClass);
          if (lastFocus) lastFocus.focus();
        }

        openers.forEach(button => button.addEventListener('click', openModal));
        closers.forEach(button => button.addEventListener('click', closeModal));
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
        });
      }

      wireSalonModal('salonServicesModal', '[data-salon-services-open]', '[data-salon-services-close]', 'salon-services-modal-open');
      wireSalonModal('salonProductsModal', '[data-salon-products-open]', '[data-salon-products-close]', 'salon-products-modal-open');
    })();

    (function(){
      const modal = document.getElementById('salonProductsModal');
      if (!modal) return;
      const dataNode = document.getElementById('salonProductsData');
      let products = [];
      try {
        products = dataNode ? JSON.parse(dataNode.textContent || '[]') : [];
      } catch (error) {
        products = [];
      }
      const byId = new Map(products.map(product => [String(product.id || ''), product]));
      const title = document.getElementById('salonProductsModalTitle');
      const subtitle = modal.querySelector('[data-products-subtitle]');
      const listView = modal.querySelector('[data-products-list]');
      const detailView = modal.querySelector('[data-product-detail]');
      const backButton = modal.querySelector('[data-product-back]');
      const mediaNode = modal.querySelector('[data-product-detail-media]');
      const originalTitle = title ? title.textContent : 'Prodotti';
      const originalSubtitle = subtitle ? subtitle.textContent : 'Consulta i prodotti disponibili per questa sede.';

      function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        }[char]));
      }

      function detailText(value) {
        const text = String(value ?? '').trim();
        if (text === '') return '<span class="salon-product-detail-empty">Non indicato</span>';
        return escapeHtml(text).replace(/\r?\n/g, '<br>');
      }

      function setText(selector, value) {
        const node = modal.querySelector(selector);
        if (node) node.textContent = String(value ?? '');
      }

      function setHtml(selector, value) {
        const node = modal.querySelector(selector);
        if (node) node.innerHTML = value;
      }

      function renderMedia(product) {
        if (!mediaNode) return;
        const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
        const name = String(product.name || 'Prodotto');
        let html = '<div class="salon-product-detail-main">';
        if (images.length) {
          html += '<img data-product-detail-main-img src="' + escapeHtml(images[0]) + '" alt="' + escapeHtml(name) + '">';
        } else {
          html += '<div class="salon-product-detail-empty-media">Nessuna immagine</div>';
        }
        html += '</div>';
        if (images.length > 1) {
          html += '<div class="salon-product-thumbs" aria-label="Immagini prodotto">';
          images.forEach((image, index) => {
            html += '<button class="salon-product-thumb' + (index === 0 ? ' is-active' : '') + '" type="button" data-product-thumb data-src="' + escapeHtml(image) + '" aria-label="Mostra immagine ' + (index + 1) + '">';
            html += '<img src="' + escapeHtml(image) + '" alt="">';
            html += '</button>';
          });
          html += '</div>';
        }
        mediaNode.innerHTML = html;
        const mainImage = mediaNode.querySelector('[data-product-detail-main-img]');
        Array.from(mediaNode.querySelectorAll('[data-product-thumb]')).forEach(button => {
          button.addEventListener('click', () => {
            if (mainImage) mainImage.setAttribute('src', button.getAttribute('data-src') || '');
            mediaNode.querySelectorAll('[data-product-thumb]').forEach(item => item.classList.remove('is-active'));
            button.classList.add('is-active');
          });
        });
      }

      function showProductList() {
        if (listView) listView.hidden = false;
        if (detailView) detailView.hidden = true;
        if (title) title.textContent = originalTitle;
        if (subtitle) subtitle.textContent = originalSubtitle;
      }

      function showProductDetail(productId) {
        const product = byId.get(String(productId));
        if (!product || !detailView || !listView) return;
        const meta = [product.category, product.brand].map(value => String(value || '').trim()).filter(Boolean).join(' · ') || 'Prodotto';
        listView.hidden = true;
        detailView.hidden = false;
        if (title) title.textContent = product.name || 'Prodotto';
        if (subtitle) subtitle.textContent = 'Scheda prodotto';
        renderMedia(product);
        setText('[data-product-detail-name]', product.name || 'Prodotto');
        setText('[data-product-detail-meta]', meta);
        setText('[data-product-detail-price]', product.price || '€ 0,00');
        setText('[data-product-detail-sku]', product.sku || '—');
        setHtml('[data-product-detail-description]', detailText(product.description));
        setHtml('[data-product-detail-ingredients]', detailText(product.ingredients));
        setHtml('[data-product-detail-warnings]', detailText(product.warnings));
        const stockNode = modal.querySelector('[data-product-detail-stock]');
        if (stockNode) {
          const stockLabel = String(product.stockLabel || '').trim();
          stockNode.textContent = stockLabel;
          stockNode.hidden = stockLabel === '';
        }
        const promoNode = modal.querySelector('[data-product-detail-promo]');
        if (promoNode) {
          const promo = product.promotion && typeof product.promotion === 'object' ? product.promotion : null;
          const promoTitle = promo ? String(promo.badgeTitle || 'Promo').trim() : '';
          let promoDetail = promo ? String(promo.badgeDetail || '').trim() : '';
          if (promo && promoDetail === '') promoDetail = String(promo.text || '').trim();
          promoNode.innerHTML = '';
          if (promoTitle !== '') {
            promoNode.innerHTML += '<span class="salon-promo-badge"><span class="salon-promo-badge-title">' + escapeHtml(promoTitle) + '</span></span>';
          }
          if (promoDetail !== '') {
            promoNode.innerHTML += '<span class="salon-promo-detail">' + escapeHtml(promoDetail) + '</span>';
          }
          promoNode.hidden = promoTitle === '' && promoDetail === '';
        }
        if (backButton instanceof HTMLElement) backButton.focus();
      }

      Array.from(modal.querySelectorAll('[data-salon-product-open]')).forEach(button => {
        button.addEventListener('click', () => showProductDetail(button.getAttribute('data-product-id') || ''));
      });
      Array.from(document.querySelectorAll('[data-salon-products-open]')).forEach(button => {
        button.addEventListener('click', showProductList);
      });
      Array.from(modal.querySelectorAll('[data-salon-products-close]')).forEach(button => {
        button.addEventListener('click', showProductList);
      });
      if (backButton) backButton.addEventListener('click', showProductList);
      showProductList();
    })();

    (function(){
      const carousels = Array.from(document.querySelectorAll('[data-location-carousel]'));
      if (!carousels.length) return;
      function visibleCount(){
        if (window.matchMedia('(max-width: 640px)').matches) return 1;
        if (window.matchMedia('(max-width: 900px)').matches) return 2;
        return 3;
      }
      carousels.forEach(carousel => {
        const track = carousel.querySelector('[data-location-track]');
        const prev = carousel.querySelector('[data-location-prev]');
        const next = carousel.querySelector('[data-location-next]');
        if (!track || !prev || !next) return;
        const cards = Array.from(track.children);
        let page = 0;
        function maxPage(){
          return Math.max(0, Math.ceil(cards.length / visibleCount()) - 1);
        }
        function update(){
          const count = visibleCount();
          page = Math.min(page, maxPage());
          const target = cards[page * count];
          const left = target ? target.offsetLeft : 0;
          track.style.transform = 'translateX(' + (-left) + 'px)';
          prev.disabled = page <= 0;
          next.disabled = page >= maxPage();
        }
        prev.addEventListener('click', () => {
          page = Math.max(0, page - 1);
          update();
        });
        next.addEventListener('click', () => {
          page = Math.min(maxPage(), page + 1);
          update();
        });
        window.addEventListener('resize', update);
        update();
      });
    })();
