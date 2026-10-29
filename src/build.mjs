// Собирает index.html из src/template.html и src/menu.json.
// Запуск из корня проекта: node src/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const menu = JSON.parse(readFileSync(join(here, 'menu.json'), 'utf8'));
let html = readFileSync(join(here, 'template.html'), 'utf8');

const NBSP = ' ';
const money = (n) => `${new Intl.NumberFormat('ru-RU').format(n)}${NBSP}₽`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const nb = (s) => s.replace(/ (г|л|шт\.)/g, `${NBSP}$1`);

const total = menu.categories.reduce((n, c) => n + c.items.length, 0);

const index = menu.categories
  .map((c) => `<a href="#${c.id}" data-cat="${c.id}">${esc(c.name)} <span>${c.items.length}</span></a>`)
  .join('\n          ');

const list = menu.categories
  .map((c) => {
    const items = c.items
      .map((d, i) => {
        const img = d.img
          ? `<img src="img/t/${d.img}.jpg" alt="" width="72" height="72" loading="lazy" decoding="async"${d.pos ? ` style="object-position:${d.pos}"` : ''}>`
          : '';
        const hasDesc = d.desc && d.desc.trim();
        return `<li class="dish" data-id="${d.id}" data-name="${esc(d.name)}" data-price="${d.price}" data-weight="${esc(nb(d.weight))}"${d.img ? ` data-img="img/${d.img}.jpg" data-thumb="img/t/${d.img}.jpg"` : ''}${d.pos ? ` data-pos="${d.pos}"` : ''} style="--i:${Math.min(i, 5)}">
            <span class="dish__plate${d.img ? '' : ' is-empty'}" aria-hidden="true">${img}</span>
            <div class="dish__body">
              <p class="dish__name">${esc(d.name)}</p>
              <p class="dish__meta">${esc(nb(d.weight))}</p>${hasDesc ? `
              <p class="dish__desc" id="d-${d.id}">${esc(d.desc)}</p>
              <button class="dish__more" type="button" aria-expanded="false" aria-controls="d-${d.id}" hidden>Подробнее</button>` : ''}
            </div>
            <div class="dish__side">
              <p class="dish__price">${money(d.price)}</p>
              <button class="dish__add" type="button" aria-label="Добавить на стол: ${esc(d.name)}, ${money(d.price)}"><span aria-hidden="true">+</span></button>
            </div>
          </li>`;
      })
      .join('\n          ');
    return `<section class="menu__cat" id="${c.id}" aria-labelledby="${c.id}-h">
        <h3 class="menu__cat-name" id="${c.id}-h">${esc(c.name)} <span>${c.items.length}</span></h3>
        <ul class="dishes">
          ${items}
        </ul>
      </section>`;
  })
  .join('\n      ');

html = html
  .replace('<!--MENU_INDEX-->', index)
  .replace('<!--MENU_LIST-->', list)
  .replaceAll('{{MENU_COUNT}}', String(total));

writeFileSync(join(root, 'index.html'), html);
console.log(`index.html: ${menu.categories.length} разделов, ${total} блюд`);
