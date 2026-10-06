// Back office enhancements. Every form still works without JavaScript.
(() => {
  // Mobile menu
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });

  // Confirmation before destructive actions
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-confirm]');
    if (trigger && !window.confirm(trigger.dataset.confirm)) event.preventDefault();
  });

  // Selects that apply immediately (filters, quick status change)
  document.querySelectorAll('[data-autosubmit]').forEach((select) => {
    select.addEventListener('change', () => select.form?.requestSubmit());
  });

  // Photo pickers: show chosen files, support drag and drop
  document.querySelectorAll('[data-dropzone]').forEach((zone) => {
    const input = zone.querySelector('[data-photo-input]');
    const names = zone.querySelector('[data-photo-names]');
    const render = () => {
      const files = [...(input.files || [])];
      names.textContent = files.length ? `${files.length} fichier${files.length > 1 ? 's' : ''} prêt${files.length > 1 ? 's' : ''} : ${files.map((file) => file.name).join(', ')}` : '';
    };
    input.addEventListener('change', render);
    ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, () => zone.classList.add('is-over')));
    ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, () => zone.classList.remove('is-over')));
  });

  // Disable submit buttons while a form is sending (uploads can take a few seconds)
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (event.defaultPrevented) return;
      const button = event.submitter;
      if (button && button.form === form) {
        window.setTimeout(() => button.setAttribute('aria-disabled', 'true'), 0);
      }
    });
  });

  // Fee rows in settings
  document.querySelectorAll('[data-add-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const container = document.querySelector(`[data-fee-rows="${button.dataset.addRow}"]`);
      const template = container.querySelector('[data-fee-row]');
      if (!template) return;
      const row = template.cloneNode(true);
      row.querySelectorAll('input').forEach((input) => {
        input.value = '';
      });
      container.appendChild(row);
      row.querySelector('input[name$="_label"]')?.focus();
    });
  });
  document.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-row]');
    if (!remove) return;
    const row = remove.closest('[data-fee-row]');
    const container = row.parentElement;
    if (container.querySelectorAll('[data-fee-row]').length > 1) row.remove();
    else row.querySelectorAll('input:not([type="hidden"])').forEach((input) => (input.value = ''));
  });

  // Event form: hide times for all-day events
  const allDay = document.querySelector('[data-all-day]');
  if (allDay) {
    const sync = () => document.querySelectorAll('[data-time]').forEach((element) => (element.hidden = allDay.checked));
    allDay.addEventListener('change', sync);
    sync();
  }

  // Animal form: live plate preview
  const form = document.querySelector('[data-animal-form]');
  if (form) {
    const preview = document.querySelector('[data-preview-plate] .plate');
    const nameOut = document.querySelector('[data-preview-name]');
    const tagOut = document.querySelector('[data-preview-tagline]');
    const figures = document.querySelector('[data-figures]');
    const compat = { oui: 'Oui', non: 'Non', a_tester: 'À tester', grands: 'Grands' };
    const housing = { appartement: 'Appart. OK', maison: 'Maison', jardin_clos: 'Jardin clos', exterieur: 'Pré' };
    const kindFor = (species, name) => {
      if (species === 'ferme') return /mouton|brebis|b[ée]lier|agneau/i.test(name) ? 'sheep' : 'goat';
      return { chien: 'dog', chat: 'cat', nac: 'rabbit' }[species] || 'dog';
    };
    const ageFrom = (value) => {
      if (!value) return '—';
      const birth = new Date(`${value}T00:00:00Z`);
      const now = new Date();
      let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (now.getUTCMonth() - birth.getUTCMonth());
      if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
      if (Number.isNaN(months) || months < 0) return '—';
      if (months < 1) return 'Quelques semaines';
      if (months < 24) return `${months} mois`;
      const years = Math.floor(months / 12);
      return years === 1 ? '1 an' : `${years} ans`;
    };
    const value = (name) => form.querySelector(`[name="${name}"]:checked`)?.value ?? form.querySelector(`[name="${name}"]`)?.value ?? '';

    const setCell = (label, text) => {
      preview?.querySelectorAll('.plate__cell').forEach((cell) => {
        if (cell.querySelector('dt')?.textContent === label) {
          const dd = cell.querySelector('dd');
          dd.textContent = text;
          dd.dataset.value = text;
        }
      });
    };

    const update = () => {
      if (!preview) return;
      const name = value('name') || 'Nom';
      nameOut.textContent = name;
      tagOut.textContent = value('tagline');
      const hex = form.querySelector('[name="backdrop"]:checked')?.dataset.hex;
      if (hex) preview.style.setProperty('--backdrop', hex);
      setCell('Âge', value('age_label') || ageFrom(value('birth_date')));
      setCell('Chats', compat[value('ok_cats')] || '—');
      setCell('Chiens', compat[value('ok_dogs')] || '—');
      setCell('Enfants', compat[value('ok_kids')] || '—');
      setCell('Logement', housing[value('housing')] || '—');
      const holder = preview.querySelector('.plate__figure');
      if (holder && figures) {
        const kind = kindFor(value('species'), `${name} ${value('breed')}`);
        if (!holder.querySelector(`.fig--${kind}`)) {
          const source = figures.content.querySelector(`[data-figure="${kind}"] svg`);
          if (source) holder.replaceChildren(source.cloneNode(true));
        }
      }
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  }
})();
