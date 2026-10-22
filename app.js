(function () {
  const C = window.SONE_CONFIG;
  const CAT_EMOJI = { 'Chicken': '🍗', 'Mutton': '🍖', 'Fish': '🐟', 'Egg': '🥚', 'Paneer': '🧀', 'Mushroom': '🍄', 'Veg Curries': '🥘', 'Dal': '🍲', 'Rice & Biryani': '🍛', 'Noodles': '🍜', 'Breads': '🫓', 'Rolls & Snacks': '🌯', 'Soup': '🥣', 'Salad & Raita': '🥗', 'Desserts': '🍮', 'Beverages': '🥤' };
  const CAT_BG = ['#FFE3D3', '#FFF0C9', '#DDF3E4', '#E1ECFF', '#F3E1FF', '#FFE0E6'];
  const emoji = c => CAT_EMOJI[c] || '🍽️';
  const bgOf = c => CAT_BG[[...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) % CAT_BG.length];

  let MENU = [], SET = {}, cart = ls.get('sone_cart', {}), onlyVeg = false, bsOnly = false, query = '';
  let profile = ls.get('sone_profile', { name: '', phone: '', address: '' });
  let myOrders = ls.get('sone_orders', []);       // [{token,no}]
  let orderData = [], lastStatus = ls.get('sone_last_status', {});
  let orderType = ls.get('sone_otype', 'delivery'), payMethod = 'upi';

  /* ---------- tabs ---------- */
  $('#t-home').innerHTML = ICON.fork; $('#ic-mq').innerHTML = ICON.search; $('#t-card').innerHTML = ICON.list; $('#t-orders').innerHTML = ICON.bag; $('#t-account').innerHTML = ICON.user; $('#ic-search').innerHTML = ICON.search;
  function tab(name) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + name));
    $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    window.scrollTo(0, 0);
    if (name === 'orders') pollOrders(true);
    cartBar();
  }
  $('#tabbar').onclick = e => { const b = e.target.closest('button'); if (b) tab(b.dataset.tab); };

  /* ---------- data ---------- */
  const open = () => String(SET.accepting_orders) !== 'false';
  async function load() {
    const [m, s] = await Promise.all([sb.from('menu_items').select('*').order('sort'), sb.from('settings').select('*')]);
    if (m.error) { $('#menu').innerHTML = `<div class="empty"><div class="big">📡</div>Menu load nahi hua.<br><button class="btn sm mt12" onclick="location.reload()">Dobara koshish karein</button></div>`; return; }
    MENU = m.data || []; SET = {}; (s.data || []).forEach(r => SET[r.key] = r.value);
    Object.keys(cart).forEach(id => { if (!MENU.find(x => x.id == id && x.available)) delete cart[id]; }); saveCart();
    renderTop(); renderHero(); renderAbout(); renderCats(); renderMenu(); renderCard(); cartBar();
  }
  function renderTop() {
    const pill = $('#open-pill');
    pill.textContent = open() ? 'Open' : 'Band hai'; pill.className = 'pill ' + (open() ? 'green' : 'red');
    const cb = $('#closed-banner'); cb.classList.toggle('hide', open());
    cb.textContent = '😴 Restaurant abhi online order nahi le raha. Menu dekh sakte hain; order thodi der baad karein.';
  }
  const saveCart = () => ls.set('sone_cart', cart);

  /* ---------- hero ---------- */
  const wa = t => `https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent(t)}`;
  const CAT_IMG = { 'Chicken': 'chicken', 'Mutton': 'mutton', 'Fish': 'fish', 'Paneer': 'paneer', 'Veg Curries': 'veg', 'Dal': 'dal', 'Rice & Biryani': 'rice', 'Noodles': 'noodles', 'Breads': 'bread', 'Rolls & Snacks': 'kabab', 'Soup': 'soup', 'Salad & Raita': 'salad' };
  const catImg = c => CAT_IMG[c] ? 'img/' + CAT_IMG[c] + '.jpg' : '';
  const setNum = (k, d) => (SET[k] == null || isNaN(Number(SET[k]))) ? d : Number(SET[k]);
  const hours = () => (typeof SET.open_hours === 'string' && SET.open_hours) ? SET.open_hours : '12:00 PM - 9:00 PM';
  function renderHero() {
    $('#hero').innerHTML = [
      { img: 'img/front_night.jpg', t: 'Sone Restaurant', p: 'Family dining · Cabins · Party Hall' },
      { img: 'img/thali1.jpg', t: 'Ghar baithe order karein', p: `Home delivery ${setNum('delivery_km', 5)} km tak · Min ₹${setNum('min_order', 300)} · ${hours()}`, href: '#order', cta: 'Abhi order karein' },
      { img: 'partyhall1.jpg', t: 'Party Hall Booking', p: 'Birthday, anniversary, kitty party', href: wa('Namaste! Mujhe Sone Restaurant ka Party Hall book karna hai.'), cta: 'WhatsApp par book karein' },
      { img: 'sonein1.jpg', t: 'Private Cabins', p: 'Family ke saath aaram se khaana' },
      { img: 'sonefront1.jpg', t: 'Dumraon Station Road', p: 'Aapka apna Sone Restaurant' }
    ].map(b => `<div class="b"><img src="${b.img}" alt="" loading="lazy"><div><h3>${b.t}</h3><p>${b.p}</p>${b.href ? `<a class="go" ${b.href === '#order' ? 'data-go="order"' : `href="${b.href}" target="_blank" rel="noopener"`}>${b.cta}</a>` : ''}</div></div>`).join('');
    $('#info-strip').innerHTML = `<div class="is"><b>🛵</b><span>Delivery<br><i>${setNum('delivery_km', 5)} km</i></span></div><div class="is"><b>⏰</b><span>Timing<br><i>${esc(hours())}</i></span></div><div class="is"><b>🧾</b><span>Minimum order<br><i>₹${setNum('min_order', 300)}</i></span></div>`;
  }
  renderHero();
  $('#hero').onclick = e => { if (e.target.closest('[data-go="order"]')) { const m = $('#menu'); scrollTo({ top: m.getBoundingClientRect().top + scrollY - 140, behavior: 'smooth' }); } };

  /* ---------- menu render ---------- */

  /* ---------- SMART SEARCH (hinglish + typo + hindi) ---------- */
  const SYN = { 'chicken': 'murga murgi chiken chikan chi', 'mutton': 'bakra khasi gosht meat', 'fish': 'machli machhli macchi', 'egg': 'anda ande omlet omelette', 'paneer': 'panir cheese', 'rice & biryani': 'chawal biryani biriyani pulao pulav fried', 'breads': 'roti naan nan paratha parantha kulcha', 'rolls & snacks': 'snack snacks nashta pakoda pakora kabab kebab roll', 'soup': 'shorba', 'salad & raita': 'salaad raita dahi', 'desserts': 'mithai sweet meetha dessert', 'beverages': 'cold drink coldrink thanda pani juice chai tea coffee', 'noodles': 'chowmein chow noodle maggi', 'dal': 'daal', 'veg curries': 'sabzi sabji sabzi veg', 'mushroom': 'mashroom khumb' };
  const HI = { 'चिकन': 'chicken', 'मुर्गा': 'chicken', 'पनीर': 'paneer', 'मटन': 'mutton', 'दाल': 'dal', 'रोटी': 'roti', 'चावल': 'rice', 'अंडा': 'egg', 'मछली': 'fish', 'सब्जी': 'veg', 'सब्ज़ी': 'veg', 'बिरयानी': 'biryani', 'चाय': 'tea', 'कॉफी': 'coffee', 'सूप': 'soup', 'पराठा': 'paratha', 'नान': 'naan', 'रायता': 'raita', 'मशरूम': 'mushroom' };
  const norm = t => String(t || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lev1 = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; };
  const IDX = new Map();
  const idxOf = i => { let v = IDX.get(i.id); if (!v) { const text = norm(i.name + ' ' + i.category + ' ' + (SYN[i.category.toLowerCase()] || '') + (i.is_veg ? ' veg' : ' nonveg non veg')); v = { text, words: text.split(' '), name: norm(i.name) }; IDX.set(i.id, v); } return v; };
  const qTokens = q => norm(q).split(' ').filter(Boolean).map(t => HI[t] || t);
  function score(i, toks) {
    const v = idxOf(i); let sc = 0;
    for (const t of toks) {
      if (v.name.startsWith(t)) sc += 5; else if (v.words.some(w => w.startsWith(t))) sc += 4; else if (v.text.includes(t)) sc += 2;
      else if (t.length >= 4 && v.words.some(w => w.length >= 4 && lev1(w, t))) sc += 1; else return 0;
    } return sc;
  }
  const matchItem = (i, q) => { const t = qTokens(q); return !t.length || score(i, t) > 0; };
  const search = (list, q) => { const t = qTokens(q); return list.map(i => [i, score(i, t)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || a[0].sort - b[0].sort).map(x => x[0]); };

  function filtered() {
    return MENU.filter(i => (!onlyVeg || i.is_veg) && (!bsOnly || i.bestseller) && matchItem(i, query));
  }
  function cats(list) { const o = []; list.forEach(i => { if (!o.includes(i.category)) o.push(i.category); }); return o; }
  function renderCats() {
    $('#cats').innerHTML = cats(MENU).map(c => `<button class="chip" data-cat="${esc(c)}">${emoji(c)} ${esc(c)}</button>`).join('');
  }
  $('#cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (!b) return; const el = $('[data-sec="' + CSS.escape(b.dataset.cat) + '"]'); if (el) { const y = el.getBoundingClientRect().top + scrollY - 150; scrollTo({ top: y, behavior: 'smooth' }); } };

  function addHTML(i) {
    if (!i.available || !open()) return `<button class="addbtn off" disabled>${i.available ? 'Band' : 'Khatam'}</button>`;
    const n = cart[i.id] || 0;
    return n ? `<div class="stepper"><button data-dec="${i.id}" aria-label="kam">−</button><span>${n}</span><button data-inc="${i.id}" aria-label="zyada">+</button></div>` : `<button class="addbtn" data-inc="${i.id}">ADD</button>`;
  }
  function itemHTML(i) {
    return `<div class="mi" data-id="${i.id}"><div class="mi-info">
      ${i.bestseller ? '<span class="bs">★ Bestseller</span><br>' : ''}<span class="vegmark ${i.is_veg ? 'veg' : 'nonveg'}"></span>
      <div class="mi-name">${esc(i.name)}</div><div class="mi-price">${money(i.price)}</div>${i.description ? `<div class="mi-desc">${esc(i.description)}</div>` : ''}</div>
      <div class="mi-img" style="background:${bgOf(i.category)}">${i.image_url ? `<img src="${esc(i.image_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span>${emoji(i.category)}</span><div class="addwrap">${addHTML(i)}</div></div></div>`;
  }
  function renderMenu() {
    const list = filtered();
    if (!list.length) { $('#menu').innerHTML = `<div class="empty"><div class="big">🔍</div>Kuch nahi mila. Doosra naam try karein.</div>`; return; }
    $('#menu').innerHTML = '<div class="menu-wrap">' + cats(list).map(c => {
      const g = list.filter(i => i.category === c);
      const ph = catImg(c); return `<div data-sec="${esc(c)}">${ph ? `<div class="cat-ban" style="background-image:url('${ph}')"><div><span>${emoji(c)} ${esc(c)}</span><small>${g.length} items</small></div></div>` : `<div class="cat-h"><span>${emoji(c)} ${esc(c)}</span><small>${g.length} items</small></div>`}${g.map(itemHTML).join('')}</div>`;
    }).join('') + '</div>';
  }
  const sug = $('#sug');
  function showSug() {
    const q = $('#q').value.trim(); if (!q) { sug.classList.add('hide'); return; }
    const r = search(MENU.filter(i => i.available), q).slice(0, 6);
    sug.classList.remove('hide');
    sug.innerHTML = r.length ? r.map(i => `<div class="sg" data-sg="${i.id}"><span class="vegmark ${i.is_veg ? 'veg' : 'nonveg'}"></span><div class="grow"><b>${esc(i.name)}</b><small>${esc(i.category)}</small></div><span class="bold">${money(i.price)}</span>${open() ? `<button class="sg-add" data-inc="${i.id}">ADD</button>` : ''}</div>`).join('') : `<div class="sg none">"${esc(q)}" nahi mila. <a href="${wa('Namaste! Mujhe ' + q + ' chahiye, kya milega?')}" target="_blank" rel="noopener">WhatsApp par poochhein</a></div>`;
  }
  $('#q').oninput = e => { query = e.target.value.trim(); renderMenu(); showSug(); };
  $('#q').onfocus = showSug;
  sug.onclick = e => { const a = e.target.closest('[data-inc]'); if (a) { change(a.dataset.inc, 1); showSug(); return; }
    const g = e.target.closest('[data-sg]'); if (g) { sug.classList.add('hide'); const el = $('.mi[data-id="' + g.dataset.sg + '"]'); if (el) { scrollTo({ top: el.getBoundingClientRect().top + scrollY - 170, behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } } };
  document.addEventListener('click', e => { if (!e.target.closest('#sug') && e.target.id !== 'q') sug.classList.add('hide'); });
  $('#veg').onchange = e => { onlyVeg = e.target.checked; renderMenu(); };
  $('#bs-btn').onclick = e => { bsOnly = !bsOnly; e.currentTarget.classList.toggle('on', bsOnly); renderMenu(); if (bsOnly && !filtered().length) toast('Abhi koi bestseller mark nahi hai'); };

  /* ---------- cart ---------- */
  function change(id, d) {
    const i = MENU.find(x => x.id == id); if (!i || !i.available || !open()) return;
    const n = Math.max(0, Math.min(20, (cart[id] || 0) + d)); if (n) cart[id] = n; else delete cart[id];
    saveCart(); haptic(8);
    $$('.mi[data-id="' + id + '"] .addwrap').forEach(w => w.innerHTML = addHTML(i));
    cartBar(); if (cartSheet) renderCart(); if (typeof renderCard === 'function') renderCard();
  }
  $('#menu').onclick = e => { const a = e.target.closest('[data-inc]'), b = e.target.closest('[data-dec]'); if (a) change(a.dataset.inc, 1); if (b) change(b.dataset.dec, -1); };
  const lines = () => Object.entries(cart).map(([id, qty]) => ({ i: MENU.find(x => x.id == id), qty })).filter(l => l.i);
  const subtotal = () => lines().reduce((s, l) => s + l.i.price * l.qty, 0);
  const count = () => lines().reduce((s, l) => s + l.qty, 0);
  function fee(type) {
    if (type !== 'delivery') return 0; const f = Number(SET.delivery_fee || 0), free = Number(SET.free_delivery_above || 0), s = subtotal();
    return free > 0 && s >= free ? 0 : f;
  }
  function cartBar() {
    const b = $('#cartbar'), n = count(), onHome = $('#v-home').classList.contains('active') || $('#v-card').classList.contains('active');
    if (!n || !onHome) { b.classList.add('hide'); return; }
    b.classList.remove('hide');
    b.innerHTML = `<div>${n} item${n > 1 ? 's' : ''}<small>Delivery/taxes checkout par</small></div><div>${money(subtotal())} &nbsp;Cart dekhein ›</div>`;
  }
  $('#cartbar').onclick = () => openCart();

  let cartSheet = null, step = 'cart';
  function openCart() { step = 'cart'; cartSheet = sheet('<div id="cs"></div>', { full: true, onClose: () => { cartSheet = null; } }); renderCart(); }
  function renderCart() {
    if (!cartSheet) return; const box = $('#cs', cartSheet.el); const L = lines();
    if (!L.length) { box.innerHTML = `<div class="sh-head"><h3>Cart</h3><button class="iconbtn" data-x>✕</button></div><div class="empty"><div class="big">🛒</div>Cart khali hai</div>`; $('[data-x]', box).onclick = () => cartSheet.close(); return; }
    return step === 'cart' ? renderCartStep(box, L) : renderCheckout(box, L);
  }
  function renderCartStep(box, L) {
    const s = subtotal(), minO = Number(SET.min_order || 0);
    box.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
    box.innerHTML = `<div class="sh-head"><h3>Aapka Cart</h3><button class="iconbtn" data-x>✕</button></div>
      <div class="sh-body"><div class="list">${L.map(l => `<div class="cl"><span class="vegmark ${l.i.is_veg ? 'veg' : 'nonveg'}"></span><div class="grow"><div class="bold">${esc(l.i.name)}</div><div class="small muted">${money(l.i.price)}</div></div>
        <div class="stepper" style="min-width:86px"><button data-dec="${l.i.id}">−</button><span>${l.qty}</span><button data-inc="${l.i.id}">+</button></div><b style="min-width:60px;text-align:right">${money(l.i.price * l.qty)}</b></div>`).join('')}</div>
        <div class="card mt12"><label class="field" style="margin:0"><span>Cooking note (optional)</span><input class="inp" id="c-note" maxlength="200" placeholder="Jaise: kam teekha, bina pyaz" value="${esc(cartNote)}"></label></div>
        <div class="card bill"><div><span>Item total</span><span>${money(s)}</span></div>
          ${Number(SET.free_delivery_above) > 0 ? `<div class="small muted"><span>🛵 ${money(SET.free_delivery_above)} se upar delivery free</span><span></span></div>` : ''}</div></div>
      <div class="sh-foot"><button class="btn block" id="c-next">Aage badhein · ${money(s)}</button></div>`;
    $('[data-x]', box).onclick = () => cartSheet.close();
    $('#c-note', box).oninput = e => { cartNote = e.target.value; };
    box.onclick = e => { const a = e.target.closest('[data-inc]'), b = e.target.closest('[data-dec]'); if (a) change(a.dataset.inc, 1); if (b) change(b.dataset.dec, -1); };
    $('#c-next', box).onclick = () => { if (!open()) return toast('Restaurant abhi band hai', 'err'); step = 'checkout'; renderCart(); };
  }
  let cartNote = '';

  /* ---------- checkout ---------- */
  function renderCheckout(box, L) {
    const s = subtotal(); if (orderType === 'delivery' && String(SET.delivery_enabled) === 'false') orderType = 'pickup';
    const f = fee(orderType), total = s + f;
    if (orderType === 'delivery' && payMethod === 'counter') payMethod = 'upi';
    if (orderType !== 'delivery' && payMethod === 'cod') payMethod = 'upi';
    const minO = setNum('min_order', 0), shortBy = orderType === 'delivery' && s < minO ? minO - s : 0;
    const types = [['delivery', '🛵 Delivery'], ['pickup', '🛍️ Pickup'], ['dine_in', '🍽️ Dine-in']].filter(t => t[0] !== 'delivery' || String(SET.delivery_enabled) !== 'false');
    const cashLabel = orderType === 'delivery' ? ['cod', '💵 Cash on delivery', 'Delivery par cash dein'] : ['counter', '💵 Counter par pay karein', 'Restaurant mein cash / UPI se'];
    const upi = `upi://pay?pa=${encodeURIComponent(SET.upi_id || C.UPI_ID)}&pn=${encodeURIComponent(SET.upi_name || C.RESTAURANT)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Sone Order')}`;
    box.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
    box.innerHTML = `<div class="sh-head"><button class="iconbtn" data-back>‹</button><h3>Checkout</h3><button class="iconbtn" data-x>✕</button></div>
      <div class="sh-body">
        <div style="padding:0 16px 12px"><div class="seg" id="k-type">${types.map(t => `<button data-t="${t[0]}" class="${orderType === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div></div>
        <div class="card"><label class="field"><span>Aapka naam</span><input class="inp" id="k-name" autocomplete="name" value="${esc(profile.name)}"></label>
          <label class="field"><span>Mobile number</span><input class="inp" id="k-phone" inputmode="numeric" maxlength="10" autocomplete="tel" value="${esc(profile.phone)}"></label>
          ${orderType === 'delivery' ? `<label class="field" style="margin:0"><span>Delivery address</span><textarea class="inp" id="k-addr" placeholder="Poora pata + landmark">${esc(profile.address)}</textarea></label>` : ''}
          ${orderType === 'dine_in' ? `<label class="field" style="margin:0"><span>Table number</span><input class="inp" id="k-table" placeholder="Jaise: 4"></label>` : ''}
        </div>
        <div class="section-h" style="padding-top:4px">Payment</div>
        <div class="list">
          <button class="opt ${payMethod === 'upi' ? 'on' : ''}" data-pm="upi"><span class="rd"></span><div class="grow"><div class="bold">📱 UPI (PhonePe / GPay / Paytm)</div><div class="small muted">Pehle pay karein, phir UTR dalein</div></div></button>
          <button class="opt ${payMethod === cashLabel[0] ? 'on' : ''}" data-pm="${cashLabel[0]}"><span class="rd"></span><div class="grow"><div class="bold">${cashLabel[1]}</div><div class="small muted">${cashLabel[2]}</div></div></button>
        </div>
        ${payMethod === 'upi' ? `<div class="card mt12"><a class="btn blue block" href="${upi}">Pay ${money(total)} with UPI app</a>
          <div class="qrbox"><img src="img/qr.jpg" alt="UPI QR"><div class="small muted">Ya QR scan karke ${money(total)} bhejein</div></div>
          <label class="field" style="margin:0"><span>Payment ke baad 12 digit UTR / Transaction ID</span><input class="inp" id="k-utr" inputmode="numeric" maxlength="12" placeholder="312345678901"></label></div>` : ''}
        ${shortBy ? `<div class="card" style="background:rgba(255,59,48,.1);color:var(--red);font-weight:600">Delivery ke liye minimum order ₹${minO} hai. ₹${shortBy} ka aur order karein, ya Pickup / Dine-in chunein.</div>` : ''}<div class="card bill mt12"><div><span>Item total</span><span>${money(s)}</span></div>${orderType === 'delivery' ? `<div><span>Delivery fee</span><span>${f ? money(f) : '<b style="color:var(--green)">FREE</b>'}</span></div>` : ''}<div class="tot"><span>To pay</span><span>${money(total)}</span></div></div>
      </div>
      <div class="sh-foot"><button class="btn block" id="k-go" ${shortBy ? 'disabled' : ''}>Order place karein · ${money(total)}</button></div>`;
    $('[data-x]', box).onclick = () => cartSheet.close();
    $('[data-back]', box).onclick = () => { step = 'cart'; renderCart(); };
    box.onclick = null;
    $('#k-type', box).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; keepFields(box); orderType = b.dataset.t; ls.set('sone_otype', orderType); renderCart(); };
    $$('[data-pm]', box).forEach(b => b.onclick = () => { keepFields(box); payMethod = b.dataset.pm; renderCart(); });
    $('#k-go', box).onclick = () => place(box, total);
  }
  function keepFields(box) { const g = id => { const e = $(id, box); return e ? e.value : null; };
    profile.name = g('#k-name') ?? profile.name; profile.phone = g('#k-phone') ?? profile.phone; profile.address = g('#k-addr') ?? profile.address; }

  async function place(box, total) {
    keepFields(box); const name = profile.name.trim(), phone = profile.phone.trim();
    const addr = $('#k-addr', box) ? $('#k-addr', box).value.trim() : '', table = $('#k-table', box) ? $('#k-table', box).value.trim() : '', utr = $('#k-utr', box) ? $('#k-utr', box).value.trim() : '';
    if (name.length < 2) return toast('Apna naam likhein', 'err');
    if (!/^[6-9]\d{9}$/.test(phone)) return toast('10 digit ka sahi mobile number likhein', 'err');
    if (orderType === 'delivery' && addr.length < 8) return toast('Poora delivery address likhein', 'err');
    if (orderType === 'dine_in' && !table) return toast('Table number likhein', 'err');
    if (payMethod === 'upi' && !/^\d{12}$/.test(utr)) return toast('Payment karke 12 digit ka UTR likhein', 'err');
    const btn = $('#k-go', box); btn.disabled = true; btn.textContent = 'Order bhej rahe hain…';
    const { data, error } = await sb.rpc('place_order', { p_name: name, p_phone: phone, p_type: orderType, p_address: addr, p_table: table,
      p_items: lines().map(l => ({ id: l.i.id, qty: l.qty })), p_payment: payMethod, p_utr: utr, p_note: cartNote });
    if (error) { btn.disabled = false; btn.textContent = 'Order place karein · ' + money(total); return toast(error.message || 'Order nahi hua', 'err'); }
    profile.address = addr || profile.address; ls.set('sone_profile', profile);
    myOrders.unshift({ token: data.track_token, no: data.order_no }); ls.set('sone_orders', myOrders.slice(0, 30));
    cart = {}; cartNote = ''; saveCart(); renderMenu(); cartBar(); cartSheet.close();
    toast('✅ Order place ho gaya! #' + data.order_no, 'ok'); haptic([40, 40, 40]); chime(1);
    tab('orders');
  }



  /* ---------- photo galleries + lightbox ---------- */
  const PAGES = [['img/pg_cover.jpg', 'Menu cover'], ['img/pg_lunch.jpg', 'Lunch & Dinner'], ['img/pg_veg.jpg', 'Egg, Veg, Paneer, Mushroom, Noodles'], ['img/pg_snacks.jpg', 'Breakfast, Snacks, Soup, Kabab'], ['img/pg_rice.jpg', 'Rice, Chinese, Sweet, Fish'], ['img/pg_mutton.jpg', 'Mutton'], ['img/pg_delivery.jpg', 'Delivery info'], ['img/pg_back.jpg', 'Sone Restaurant']];
  const PLACE = [['img/front_night.jpg', 'Sone Restaurant (raat)'], ['sonefront1.jpg', 'Sone Restaurant'], ['sonein.jpg', 'Dining hall'], ['sonein1.jpg', 'Private cabins'], ['partyhall.jpg', 'Party Hall'], ['partyhall1.jpg', 'Birthday decoration']];
  window.__G = { place: PLACE, pages: PAGES };
  function lightbox(list, i) {
    const w = document.createElement('div'); w.className = 'lb';
    const draw = () => { w.innerHTML = `<button class="lb-x" aria-label="band">✕</button><button class="lb-n lb-p">‹</button><img src="${list[i][0]}" alt=""><button class="lb-n lb-nx">›</button><div class="lb-c">${esc(list[i][1])} · ${i + 1}/${list.length}</div>`; };
    const go = d => { i = (i + d + list.length) % list.length; draw(); };
    w.onclick = e => { if (e.target.closest('.lb-x') || e.target === w) w.remove(); else if (e.target.closest('.lb-p')) go(-1); else if (e.target.closest('.lb-nx')) go(1); };
    let x0 = null; w.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    w.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
    draw(); document.body.appendChild(w);
  }

  /* ---------- MENU CARD (chhape hue menu jaisa) ---------- */
  function cardRows() {
    const rows = [], idx = {};
    MENU.forEach(i => {
      let m = i.name.match(/^(.*?)\s*\((Full|Half)\)$/), base = m ? m[1] : i.name, kind = m ? m[2] : null;
      const key = i.category + '|' + base.toLowerCase();
      if (!kind && !idx[key] && MENU.some(x => x.category === i.category && x.name.toLowerCase() === (base + ' (half)').toLowerCase())) kind = 'Full';
      if (!kind && idx[key]) { rows.push({ cat: i.category, name: i.name, opts: [{ l: '', i }], veg: i.is_veg, bs: i.bestseller }); return; }
      if (kind === 'Half' && !idx[key] && !MENU.some(x => x.category === i.category && (x.name.toLowerCase() === base.toLowerCase() || x.name.toLowerCase() === (base + ' (full)').toLowerCase()))) kind = null;
      if (!kind) { rows.push({ cat: i.category, name: base, opts: [{ l: '', i }], veg: i.is_veg, bs: i.bestseller }); return; }
      let r = idx[key]; if (!r) { r = idx[key] = { cat: i.category, name: base, opts: [], veg: i.is_veg, bs: false }; rows.push(r); }
      r.opts.push({ l: kind === 'Half' ? 'Half' : 'Full', i }); r.bs = r.bs || i.bestseller;
    });
    rows.forEach(r => r.opts.sort((a, b) => (a.l === 'Half' ? -1 : 0) - (b.l === 'Half' ? -1 : 0)));
    return rows;
  }
  let cq = '';
  function renderCard() {
    const box = $('#mc'); if (!box) return; if (!MENU.length) { box.innerHTML = '<div class="spin"></div>'; return; }
    const rows = cardRows().filter(r => !cq || r.opts.some(o => matchItem(o.i, cq)) || matchItem({ id: 'r' + r.name, name: r.name, category: r.cat, is_veg: r.veg, sort: 0 }, cq)), cs = [...new Set(rows.map(r => r.cat))], can = open();
    const chip = (o) => { const i = o.i, n = cart[i.id] || 0, off = !i.available || !can;
      return `<button class="mc-p ${n ? 'in' : ''} ${off ? 'off' : ''}" ${off ? 'disabled' : `data-inc="${i.id}"`}>${o.l ? `<small>${o.l}</small>` : ''}<b>₹${Number(i.price)}</b>${n ? `<i>${n}</i>` : ''}</button>`; };
    box.innerHTML = `
      <div class="mc-head"><div class="mc-orn"><span></span>✦<span></span></div><img src="sonelogo.png" alt="Sone"><h1>SONE RESTAURANT</h1><div class="mc-sub">OFFICIAL MENU</div><div class="mc-addr">Dumraon Station Road, Bihar</div>
        <div class="mc-note">Kisi bhi daam par tap karke cart mein daalein</div></div>
      <nav class="mc-nav">${cs.map(c => `<button data-mcc="${esc(c)}">${emoji(c)} ${esc(c)}</button>`).join('')}</nav>
      <div class="mc-paper">${cs.map(c => `<section data-mcs="${esc(c)}"><h2><span class="ln"></span><span class="tt">${catImg(c) ? `<img class="mc-med" src="${catImg(c)}" alt="" loading="lazy">` : ''}${emoji(c)} ${esc(c)}</span><span class="ln"></span></h2>
        ${rows.filter(r => r.cat === c).map(r => `<div class="mc-row"><div class="mc-nm"><span class="vegmark ${r.veg ? 'veg' : 'nonveg'}"></span><span>${esc(r.name)}${r.bs ? ' <em>★</em>' : ''}</span></div><span class="mc-dots"></span><div class="mc-pr">${r.opts.map(chip).join('')}</div></div>`).join('')}</section>`).join('')}
        ${cs.length ? '' : '<div class="empty" style="color:#6b5a45">Kuch nahi mila. Doosra naam try karein.</div>'}<div class="mc-end"><div class="mc-orn"><span></span>✦<span></span></div>Dhanyavaad · Phir padhariyega 🙏</div></div>
      <div class="mc-pages"><h3>📖 Asli Menu Card ke pages</h3><div class="strip" id="pg-strip">${PAGES.map((p, k) => `<img src="${p[0]}" alt="${p[1]}" data-pg="${k}" loading="lazy">`).join('')}</div></div>`;
  }
  $('#mc-q').oninput = e => { cq = e.target.value.trim(); renderCard(); };
  document.addEventListener('click', e => { const pg = e.target.closest('[data-pgs]'); if (pg) lightbox(window.__G[pg.dataset.pgs], Number(pg.dataset.i)); });
  $('#mc').onclick = e => {
    const a = e.target.closest('[data-inc]'); if (a) { change(a.dataset.inc, 1); return; }
    const n = e.target.closest('[data-mcc]'); if (n) { const el = $('[data-mcs="' + CSS.escape(n.dataset.mcc) + '"]'); if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' }); return; }
    const pg = e.target.closest('[data-pg]'); if (pg) lightbox(PAGES, Number(pg.dataset.pg));
  };

  /* ---------- orders / tracking ---------- */
  const STEPS = { delivery: ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed'], pickup: ['placed', 'accepted', 'preparing', 'ready', 'completed'], dine_in: ['placed', 'accepted', 'preparing', 'ready', 'completed'] };
  const CUST_LABEL = { placed: 'Order mil gaya', accepted: 'Restaurant ne accept kiya', preparing: 'Khaana ban raha hai', ready: 'Khaana ready hai', out_for_delivery: 'Delivery partner raste mein', completed: 'Complete' };
  const ACTIVE = s => s !== 'completed' && s !== 'cancelled';
  async function pollOrders(force) {
    if (!myOrders.length) { orderData = []; renderOrders(); return; }
    const { data, error } = await sb.rpc('track_orders', { p_tokens: myOrders.map(o => o.token) });
    if (error) { if (force) toast('Orders load nahi hue', 'err'); return; }
    orderData = data || [];
    orderData.forEach(o => {
      const prev = lastStatus[o.order_no];
      if (prev && prev !== o.status) { const msg = o.status === 'cancelled' ? `Order #${o.order_no} cancel ho gaya` : `Order #${o.order_no}: ${CUST_LABEL[o.status]}`; toast(msg, o.status === 'cancelled' ? 'err' : 'ok'); chime(1); haptic([60, 40, 60]); }
      lastStatus[o.order_no] = o.status;
    });
    ls.set('sone_last_status', lastStatus); renderOrders();
  }
  function renderOrders() {
    const act = orderData.filter(o => ACTIVE(o.status)).length, d = $('#orders-dot'); d.textContent = act; d.classList.toggle('hide', !act);
    const box = $('#orders-list');
    if (!orderData.length) { box.innerHTML = `<div class="empty"><div class="big">🧾</div>Abhi tak koi order nahi.<br>Menu se pehla order karein!<br><button class="btn sm mt12" id="go-menu">Menu dekhein</button></div>`; const g = $('#go-menu'); if (g) g.onclick = () => tab('home'); return; }
    box.innerHTML = orderData.map(o => {
      const steps = STEPS[o.order_type], idx = steps.indexOf(o.status), cancelled = o.status === 'cancelled';
      const log = {}; (o.status_log || []).forEach(l => log[l.s] = l.t);
      return `<div class="oc"><div class="row between"><div><b style="font-size:17px">#${esc(o.order_no)}</b><div class="xs muted">${fmtDT(o.created_at)} · ${TYPE_LABEL[o.order_type]}</div></div>
        <span class="pill ${cancelled ? 'red' : o.status === 'completed' ? 'green' : 'orange'}">${cancelled ? 'Cancelled' : o.status === 'completed' ? 'Complete' : CUST_LABEL[o.status]}</span></div>
        <div class="small muted mt8">${(o.items || []).map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</div>
        ${cancelled ? `<div class="small mt8" style="color:var(--red)">${esc(o.cancel_reason || 'Restaurant ne order cancel kiya')}</div>` : `<div class="tl">${steps.map((s, k) => `<div class="st ${k < idx || o.status === 'completed' ? 'done' : k === idx ? 'now' : ''}"><div class="dotc">${k < idx || o.status === 'completed' ? ICON.check : ''}</div><div class="grow">${CUST_LABEL[s]}${log[s] ? ` <span class="xs muted">${fmtTime(log[s])}</span>` : ''}</div></div>`).join('')}</div>`}
        <div class="row between mt12"><div class="small"><span class="muted">${PAY_LABEL[o.payment_method]}</span> <span class="pill ${o.payment_status === 'paid' ? 'green' : 'orange'}">${o.payment_status === 'paid' ? 'Paid' : 'Verify ho raha hai'}</span></div><b style="font-size:18px">${money(o.total)}</b></div>
        <div class="row gap8 mt12">
          ${o.status === 'placed' ? `<button class="btn red sm grow" data-cancel="${o.track_token}">Cancel karein</button>` : ''}
          ${ACTIVE(o.status) ? `<a class="btn sec sm grow" href="tel:${C.WHATSAPP.slice(2)}">📞 Restaurant ko call</a>` : `<button class="btn sec sm grow" data-again="${o.track_token}">🔁 Dobara order karein</button>`}
        </div></div>`;
    }).join('');
  }
  $('#orders-list').onclick = async e => {
    const c = e.target.closest('[data-cancel]'), a = e.target.closest('[data-again]');
    if (c && await confirmBox('Order cancel karein?', 'Cancel karein', true)) {
      const { data, error } = await sb.rpc('cancel_my_order', { p_token: c.dataset.cancel });
      if (error || !data) toast('Order ab cancel nahi ho sakta (restaurant accept kar chuka hai). Call karein.', 'err'); else toast('Order cancel ho gaya'); pollOrders(true);
    }
    if (a) { const o = orderData.find(x => x.track_token === a.dataset.again); if (!o) return; let n = 0; (o.items || []).forEach(i => { const m = MENU.find(x => x.id == i.id && x.available); if (m) { cart[m.id] = Math.min(20, i.qty); n++; } }); saveCart(); renderMenu(); cartBar(); tab('home'); toast(n ? 'Items cart mein daal diye' : 'Ye items ab available nahi hain', n ? 'ok' : 'err'); if (n) openCart(); }
  };
  setInterval(() => { if (myOrders.length && (orderData.some(o => ACTIVE(o.status)) || $('#v-orders').classList.contains('active')) && !document.hidden) pollOrders(); }, 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pollOrders(); load(); } });

  /* ---------- account ---------- */
  $('#p-name').value = profile.name; $('#p-phone').value = profile.phone; $('#p-addr').value = profile.address;
  $('#p-save').onclick = () => {
    const ph = $('#p-phone').value.trim(); if (ph && !/^[6-9]\d{9}$/.test(ph)) return toast('Sahi mobile number likhein', 'err');
    profile = { name: $('#p-name').value.trim(), phone: ph, address: $('#p-addr').value.trim() }; ls.set('sone_profile', profile); toast('Save ho gaya ✓', 'ok');
  };
  function renderAbout() {
    $('#about').innerHTML = `<div class="card"><img src="sonelogo1.png" alt="Sone Restaurant" style="width:70%;max-width:260px;display:block;margin:0 auto;background:#fff;border-radius:12px;padding:8px">
      <div class="bill mt12"><div><span>🛵 Home delivery</span><span>${setNum('delivery_km', 5)} km tak</span></div><div><span>⏰ Timing</span><span>${esc(hours())}</span></div><div><span>🧾 Minimum order (delivery)</span><span>₹${setNum('min_order', 300)}</span></div>${setNum('free_delivery_above', 0) > 0 ? `<div><span>🎁 Free delivery</span><span>₹${setNum('free_delivery_above', 0)} se upar</span></div>` : ''}</div></div>
      <div class="section-h" style="padding-top:2px">Hamari jagah</div><div class="about-img">${PLACE.map((p, k) => `<img src="${p[0]}" alt="${esc(p[1])}" data-pgs="place" data-i="${k}" loading="lazy">`).join('')}</div>
      <div class="section-h">Asli menu card</div><div class="about-img">${PAGES.map((p, k) => `<img src="${p[0]}" alt="${esc(p[1])}" data-pgs="pages" data-i="${k}" loading="lazy" style="width:120px;height:160px;object-position:top">`).join('')}</div>`;
  }
  renderAbout();
  $('#contact-list').innerHTML = `<a class="li chev" href="tel:${C.WHATSAPP.slice(2)}"><span class="grow t">📞 Call karein</span><span class="muted">${C.WHATSAPP.slice(2)}</span></a>
    <a class="li chev" href="${wa('Namaste Sone Restaurant!')}" target="_blank" rel="noopener"><span class="grow t">💬 WhatsApp</span></a>
    <a class="li chev" href="${wa('Namaste! Mujhe Sone Restaurant ka Party Hall book karna hai.')}" target="_blank" rel="noopener"><span class="grow t">🎉 Party Hall book karein</span></a>
    <a class="li chev" href="https://maps.google.com/?q=${encodeURIComponent('Sone Restaurant Dumraon Station Road')}" target="_blank" rel="noopener"><span class="grow t">📍 Map par dekhein</span></a>`;

  /* ---------- PWA ---------- */
  let dp; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); dp = e; $('#install-box').classList.remove('hide'); });
  $('#install-btn').onclick = async () => { if (!dp) return; dp.prompt(); await dp.userChoice; dp = null; $('#install-box').classList.add('hide'); };
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  load(); pollOrders();
})();
