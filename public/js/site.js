// Progressive enhancement for the public site. Every feature degrades to plain links and content.
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function storage() {
    try {
      const key = '__refuge_test__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return window.localStorage;
    } catch {
      return null;
    }
  }

  // Mobile navigation drawer
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        toggle.focus();
      }
    });
  }

  // Hero carousel: one portrait plate at a time, the frame tinted by its backdrop.
  const carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    const count = Number(carousel.dataset.count) || 0;
    const counter = carousel.querySelector('[data-counter]');
    let index = 0;
    let timer = null;

    const tintFor = (i) => {
      const plate = carousel.querySelector(`.hero__plate[data-slide="${i}"] .plate`);
      const backdrop = plate ? getComputedStyle(plate).getPropertyValue('--backdrop').trim() : '';
      return backdrop ? `color-mix(in srgb, ${backdrop} 16%, #f6eff0)` : '';
    };

    const show = (next) => {
      if (!count) return;
      index = (next + count) % count;
      carousel.querySelectorAll('[data-slide]').forEach((element) => {
        const active = Number(element.dataset.slide) === index;
        element.classList.toggle('is-active', active);
        element.toggleAttribute('inert', !active && !element.matches('.hero__name, .hero__line'));
        if (active) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', 'true');
      });
      if (counter) counter.textContent = String(index + 1).padStart(2, '0');
      const tint = tintFor(index);
      if (tint) carousel.style.setProperty('--hero-tint', tint);
    };

    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (reduceMotion || count < 2 || timer) return;
      timer = setInterval(() => show(index + 1), 7000);
    };

    carousel.querySelector('[data-next]')?.addEventListener('click', () => {
      stop();
      show(index + 1);
    });
    carousel.querySelector('[data-prev]')?.addEventListener('click', () => {
      stop();
      show(index - 1);
    });
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    // Swipe on the plate
    let touchX = null;
    const plates = carousel.querySelector('.hero__plates');
    plates?.addEventListener('touchstart', (event) => {
      touchX = event.touches[0].clientX;
    }, { passive: true });
    plates?.addEventListener('touchend', (event) => {
      if (touchX === null) return;
      const delta = event.changedTouches[0].clientX - touchX;
      if (Math.abs(delta) > 40) {
        stop();
        show(index + (delta < 0 ? 1 : -1));
      }
      touchX = null;
    });

    show(0);
    start();
  }

  // Coups de coeur, remembered on this device only.
  const store = storage();
  const hearts = new Set(JSON.parse(store?.getItem('refuge:hearts') || '[]'));
  const markPlates = (id, on) => {
    document.querySelectorAll(`[data-plate][data-id="${id}"]`).forEach((plate) => plate.classList.toggle('is-loved', on));
  };
  document.querySelectorAll('[data-heart]').forEach((button) => {
    const id = button.dataset.heart;
    button.setAttribute('aria-pressed', String(hearts.has(id)));
    markPlates(id, hearts.has(id));
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const on = !hearts.has(id);
      if (on) hearts.add(id);
      else hearts.delete(id);
      document.querySelectorAll(`[data-heart="${id}"]`).forEach((twin) => {
        twin.setAttribute('aria-pressed', String(on));
        twin.classList.remove('is-popping');
        void twin.offsetWidth;
        if (on) twin.classList.add('is-popping');
      });
      markPlates(id, on);
      store?.setItem('refuge:hearts', JSON.stringify([...hearts]));
    });
  });

  // Desynchronise blinking so a grid of animals never blinks in unison.
  document.querySelectorAll('.fig').forEach((svg, i) => {
    svg.style.setProperty('--blink-delay', `${-((i * 1.7) % 5.5).toFixed(2)}s`);
  });

  // Scroll reveal
  const revealables = document.querySelectorAll('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealables.forEach((element) => observer.observe(element));
  } else {
    revealables.forEach((element) => element.classList.add('is-visible'));
  }

  // Animal page gallery
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const main = gallery.querySelector('.plate__photo');
    gallery.querySelectorAll('[data-photo]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!main) return;
        main.src = button.dataset.photo;
        gallery.querySelectorAll('[data-photo]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      });
    });
  }

  // Contact form: the home description only matters for adoption and foster requests.
  const topicInputs = document.querySelectorAll('input[name="topic"]');
  const homeField = document.querySelector('[data-home-field]');
  if (topicInputs.length && homeField) {
    const update = () => {
      const topic = document.querySelector('input[name="topic"]:checked')?.value;
      homeField.hidden = !['adoption', 'accueil'].includes(topic);
    };
    topicInputs.forEach((input) => input.addEventListener('change', update));
    update();
  }
})();
