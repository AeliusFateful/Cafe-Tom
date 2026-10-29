// Кафе «Томь»: меню, стол для заказа навынос, бронь, движение.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = new Intl.NumberFormat('ru-RU');
  const rub = (n) => `${fmt.format(n)} ₽`;
  const PHONE = '79059959235';
  const wa = (text) => `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* приватный режим */ } },
  };

  /* Появление блоков: один раз, когда верх блока на 88% высоты экрана */
  const revealAll = () => $$('[data-reveal], .dish, [data-open]:not(.plate--hero)').forEach((el) => el.classList.add('is-in'));
  try {
    if (!('IntersectionObserver' in window)) throw new Error('no IO');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    $$('[data-reveal], .dish').forEach((el) => io.observe(el));

    /* Круглое раскрытие: следим за родителем, потому что у обрезанной в ноль тарелки нет площади пересечения */
    const opening = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        $$('[data-open]', e.target).forEach((plate) => plate.classList.add('is-in'));
        opening.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    new Set($$('[data-open]:not(.plate--hero)').map((el) => el.parentElement)).forEach((p) => opening.observe(p));
  } catch {
    revealAll();
  }

  /* Меню: раскрывающиеся описания */
  const dishes = $$('.dish');
  const measureDescriptions = () => {
    for (const dish of dishes) {
      const desc = $('.dish__desc', dish);
      const more = $('.dish__more', dish);
      if (!desc || !more) continue;
      if (dish.classList.contains('is-open')) { more.hidden = false; continue; }
      more.hidden = desc.scrollHeight <= desc.clientHeight + 1;
    }
  };
  $('.menu__list')?.addEventListener('click', (e) => {
    const more = e.target.closest('.dish__more');
    if (!more) return;
    const dish = more.closest('.dish');
    const open = dish.classList.toggle('is-open');
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Свернуть' : 'Подробнее';
  });
  measureDescriptions();
  document.fonts?.ready.then(measureDescriptions);
  let lastWidth = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastWidth) { lastWidth = innerWidth; measureDescriptions(); } });

  /* Меню: большая тарелка сбоку показывает блюдо под рукой */
  const preview = $('.menu__preview');
  if (preview) {
    const img = $('img', preview);
    const label = $('.plate__label', preview);
    const nameEl = $('[data-p="name"]', preview);
    const metaEl = $('[data-p="meta"]', preview);
    const warmed = new Set();
    const show = (dish) => {
      const src = dish.dataset.img;
      nameEl.textContent = dish.dataset.name;
      metaEl.textContent = `${dish.dataset.weight} · ${rub(+dish.dataset.price)}`;
      label.textContent = dish.dataset.name;
      preview.classList.toggle('is-empty', !src);
      if (!src) return;
      if (!warmed.has(src)) {
        warmed.add(src);
        dishes.forEach((d) => { if (d.dataset.img && !warmed.has(d.dataset.img)) { warmed.add(d.dataset.img); new Image().src = d.dataset.img; } });
      }
      img.style.objectPosition = dish.dataset.pos || '';
      if (img.getAttribute('src') === src) return;
      img.style.opacity = '0';
      const next = new Image();
      next.onload = next.onerror = () => { img.src = src; img.style.opacity = '1'; };
      next.src = src;
    };
    const first = dishes.find((d) => d.dataset.img);
    if (first) show(first);
    dishes.forEach((dish) => {
      dish.addEventListener('pointerenter', () => { if (fine.matches) show(dish); });
      dish.addEventListener('focusin', () => { if (fine.matches) show(dish); });
    });
  }

  /* Меню: подсветка раздела, в котором читатель */
  const links = $$('.menu__index a');
  const cats = $$('.menu__cat');
  if (links.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle('is-active', a.dataset.cat === e.target.id));
      }
    }, { rootMargin: '-25% 0px -65% 0px' });
    cats.forEach((c) => spy.observe(c));
    links[0].classList.add('is-active');
  }

  /* Стол: корзина для заказа навынос */
  const dialog = $('#table');
  const cartBtn = $('#cart-open');
  const lines = $('#table-lines');
  const empty = $('#table-empty');
  const foot = $('#table-foot');
  const totalEl = $('#table-total');
  const sendEl = $('#table-send');
  const countEl = $('#cart-count');
  const countSr = $('#cart-sr');
  const live = Object.assign(document.createElement('p'), { className: 'sr-only' });
  live.setAttribute('aria-live', 'polite');
  document.body.append(live);

  const byId = new Map(dishes.map((d) => [d.dataset.id, d]));
  const state = new Map();
  try {
    const saved = JSON.parse(store.get('tom-table') || '{}');
    for (const [id, qty] of Object.entries(saved)) if (byId.has(id) && qty > 0) state.set(id, Math.min(+qty, 99));
  } catch { /* повреждённые данные */ }

  const orderText = () => {
    const rows = [...state].map(([id, qty]) => {
      const d = byId.get(id).dataset;
      return `• ${d.name} × ${qty} — ${rub(d.price * qty)}`;
    });
    const sum = [...state].reduce((n, [id, qty]) => n + byId.get(id).dataset.price * qty, 0);
    return `Здравствуйте! Хочу заказать навынос:\n${rows.join('\n')}\nИтого: ${rub(sum)}\nЗабрать к: `;
  };

  const render = (bump = false) => {
    let count = 0;
    let sum = 0;
    lines.replaceChildren();
    for (const [id, qty] of state) {
      const dish = byId.get(id);
      const d = dish.dataset;
      count += qty;
      sum += d.price * qty;
      const li = document.createElement('li');
      li.className = 'line-item';
      li.dataset.id = id;
      li.innerHTML = `
        <span class="line-item__plate">${d.img ? `<img src="${d.img}" alt="" width="52" height="52" style="object-position:${d.pos || '50% 50%'}">` : ''}</span>
        <div><p class="line-item__name"></p><p class="line-item__sum">${rub(d.price * qty)}</p></div>
        <div class="stepper"><button type="button" data-step="-1" aria-label="Убрать одну порцию"><span aria-hidden="true">−</span></button><output aria-live="off">${qty}</output><button type="button" data-step="1" aria-label="Добавить ещё порцию"><span aria-hidden="true">+</span></button></div>`;
      $('.line-item__name', li).textContent = d.name;
      lines.append(li);
    }
    dishes.forEach((dish) => dish.classList.toggle('is-added', state.has(dish.dataset.id)));
    empty.hidden = count > 0;
    foot.hidden = count === 0;
    totalEl.textContent = rub(sum);
    sendEl.href = count ? wa(orderText()) : '#';
    countEl.textContent = count;
    countSr.textContent = count;
    cartBtn.hidden = count === 0;
    if (bump) {
      cartBtn.classList.remove('is-bump');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('is-bump');
    }
    store.set('tom-table', JSON.stringify(Object.fromEntries(state)));
    if (count === 0 && dialog.open) dialog.close();
  };

  const change = (id, delta) => {
    const next = (state.get(id) || 0) + delta;
    if (next <= 0) state.delete(id); else state.set(id, Math.min(next, 99));
    render(delta > 0);
  };

  $('.menu__list')?.addEventListener('click', (e) => {
    const add = e.target.closest('.dish__add');
    if (!add) return;
    const dish = add.closest('.dish');
    change(dish.dataset.id, 1);
    live.textContent = `${dish.dataset.name} добавлено на стол. Всего блюд: ${[...state.values()].reduce((a, b) => a + b, 0)}`;
  });
  lines.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    change(btn.closest('.line-item').dataset.id, +btn.dataset.step);
  });
  cartBtn.addEventListener('click', () => dialog.showModal());
  $('#table-close').addEventListener('click', () => dialog.close());
  $('#table-clear').addEventListener('click', () => { state.clear(); render(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  render();

  /* Банкеты: вкладки с фотографиями зала */
  const tabs = $$('.tabs [role="tab"]');
  if (tabs.length) {
    const pick = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $(`#${t.getAttribute('aria-controls')}`).classList.toggle('is-on', on);
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => pick(tab));
      tab.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length], true); }
      });
    });
  }

  /* Бронь: заявка уходит в WhatsApp */
  const form = $('#book');
  if (form) {
    const error = $('.coupon__error', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const bad = [...form.elements].filter((el) => el.name && el.required && !String(data.get(el.name) || '').trim());
      [...form.elements].forEach((el) => el.removeAttribute?.('aria-invalid'));
      if (bad.length) {
        bad.forEach((el) => el.setAttribute('aria-invalid', 'true'));
        error.hidden = false;
        error.textContent = 'Заполните все поля, чтобы мы приняли заявку.';
        bad[0].focus();
        return;
      }
      error.hidden = true;
      const when = new Date(data.get('when'));
      const whenText = isNaN(when) ? String(data.get('when')) : when.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const text = `Здравствуйте! Хочу забронировать стол.\nИмя: ${data.get('name')}\nТелефон: ${data.get('phone')}\nКогда: ${whenText}\nГостей: ${data.get('guests')}`;
      window.open(wa(text), '_blank', 'noopener');
    });
    const when = $('input[name="when"]', form);
    if (when) {
      const pad = (n) => String(n).padStart(2, '0');
      const now = new Date();
      when.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
  }
})();
