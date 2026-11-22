'use strict';

/*
 * マレーシア ショッピングモールガイド
 *
 * セキュリティ方針:
 *  - ユーザー入力は innerHTML を使わず、textContent / createElement でのみ描画（XSS 対策）
 *  - URL は http / https のみ許可（javascript: などを拒否）
 *  - 外部リンクには rel="noopener noreferrer" を付与
 *  - localStorage から読んだデータも信用せず、毎回検証してから使用
 *  - インラインスクリプトなし（index.html の CSP で禁止）
 */
(() => {
  const STORAGE_KEY = 'malaysia-malls:v1';
  const MALAYSIA_CENTER = { lat: 4.2105, lng: 108.0 };
  // マレーシア国内のおおよその範囲（半島部＋ボルネオ島）
  const MALAYSIA_BOUNDS = { minLat: 0.5, maxLat: 7.6, minLng: 99.5, maxLng: 119.5 };
  const LIMITS = { name: 100, description: 500, url: 300 };

  const STATES = Object.freeze({
    KUL: 'クアラルンプール',
    SGR: 'セランゴール',
    PJY: 'プトラジャヤ',
    PNG: 'ペナン',
    JHR: 'ジョホール',
    MLK: 'マラッカ',
    NSN: 'ヌグリ・スンビラン',
    PRK: 'ペラ',
    KDH: 'ケダ',
    PLS: 'ペルリス',
    KTN: 'ケランタン',
    TRG: 'トレンガヌ',
    PHG: 'パハン',
    SBH: 'サバ',
    SWK: 'サラワク',
    LBN: 'ラブアン',
  });

  // サンプルデータ（座標・URL は目安です。公開前に確認してください）
  const SAMPLE_MALLS = Object.freeze([
    { id: 'sample-pavilion', name: 'Pavilion Kuala Lumpur', state: 'KUL', lat: 3.1490, lng: 101.7139,
      url: 'https://www.pavilion-kl.com/',
      description: 'ブキッ・ビンタン地区にある大型モール。高級ブランドから飲食店まで幅広く揃う。' },
    { id: 'sample-suria', name: 'Suria KLCC', state: 'KUL', lat: 3.1579, lng: 101.7120,
      url: 'https://www.suriaklcc.com.my/',
      description: 'ペトロナスツインタワーの足元にあるモール。KLCC 公園に隣接。' },
    { id: 'sample-midvalley', name: 'Mid Valley Megamall', state: 'KUL', lat: 3.1178, lng: 101.6773,
      url: 'https://www.midvalley.com.my/',
      description: 'KL 中心部からアクセスしやすい巨大モール。隣接する The Gardens Mall とつながっている。' },
    { id: 'sample-sunway', name: 'Sunway Pyramid', state: 'SGR', lat: 3.0727, lng: 101.6068,
      url: 'https://www.sunwaypyramid.com/',
      description: 'ピラミッド型の外観が特徴。館内にアイススケートリンクがある。' },
    { id: 'sample-1utama', name: '1 Utama Shopping Centre', state: 'SGR', lat: 3.1503, lng: 101.6156,
      url: 'https://www.1utama.com.my/',
      description: 'ペタリン・ジャヤにある大型モール。屋上庭園なども楽しめる。' },
    { id: 'sample-ioicity', name: 'IOI City Mall', state: 'PJY', lat: 2.9696, lng: 101.7137,
      url: 'https://www.ioicitymall.com.my/',
      description: 'プトラジャヤ近郊の大型モール。アイスリンクや屋内テーマパークがある。' },
    { id: 'sample-gurney', name: 'Gurney Plaza', state: 'PNG', lat: 5.4373, lng: 100.3094,
      url: 'https://www.gurneyplaza.com.my/',
      description: 'ペナン島ガーニー・ドライブ沿いの人気モール。' },
  ]);

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const el = {
    map: $('#map'),
    mapMessage: $('#map-message'),
    form: $('#mall-form'),
    name: $('#f-name'),
    state: $('#f-state'),
    desc: $('#f-desc'),
    url: $('#f-url'),
    lat: $('#f-lat'),
    lng: $('#f-lng'),
    formError: $('#form-error'),
    search: $('#search'),
    filterState: $('#filter-state'),
    list: $('#mall-list'),
    count: $('#count'),
    resetData: $('#reset-data'),
  };

  const app = {
    malls: [],
    map: null,
    infoWindow: null,
    markers: new Map(),
    draftMarker: null,
    AdvancedMarkerElement: null,
    PinElement: null,
  };

  // ---------- 検証ユーティリティ ----------
  function newId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function cleanText(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  /** http/https の URL のみ返す。不正なら null */
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > LIMITS.url) return null;
    try {
      const u = new URL(value.trim());
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch {
      return null;
    }
  }

  const isLat = (n) => Number.isFinite(n) && n >= -90 && n <= 90;
  const isLng = (n) => Number.isFinite(n) && n >= -180 && n <= 180;
  const inMalaysia = (lat, lng) =>
    lat >= MALAYSIA_BOUNDS.minLat && lat <= MALAYSIA_BOUNDS.maxLat &&
    lng >= MALAYSIA_BOUNDS.minLng && lng <= MALAYSIA_BOUNDS.maxLng;

  /** 任意のオブジェクトを検証済みのモールデータに変換。不正なら null */
  function toMall(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = cleanText(raw.name, LIMITS.name);
    const description = cleanText(raw.description, LIMITS.description);
    const state = typeof raw.state === 'string' && Object.hasOwn(STATES, raw.state) ? raw.state : null;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const url = raw.url ? safeUrl(raw.url) : '';
    if (!name || !state || !isLat(lat) || !isLng(lng) || url === null) return null;
    const id = typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : newId();
    return { id, name, state, description, url, lat, lng };
  }

  // ---------- 保存 ----------
  function sampleCopy() {
    return SAMPLE_MALLS.map((m) => toMall(m)).filter(Boolean);
  }

  function loadMalls() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return sampleCopy();
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return sampleCopy();
      return data.map(toMall).filter(Boolean);
    } catch {
      return sampleCopy();
    }
  }

  function saveMalls() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.malls));
      return true;
    } catch {
      alert('データを保存できませんでした（ストレージが使用できないか、容量不足です）。');
      return false;
    }
  }

  // ---------- 描画 ----------
  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function externalLink(href, text) {
    const a = create('a', '', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function googleMapsUrl(mall) {
    // 数値のみを埋め込むので安全
    return `https://www.google.com/maps/search/?api=1&query=${mall.lat},${mall.lng}`;
  }

  function filteredMalls() {
    const q = el.search.value.trim().toLowerCase();
    const s = el.filterState.value;
    return app.malls.filter((m) =>
      (!s || m.state === s) &&
      (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)));
  }

  function render() {
    const list = filteredMalls();
    renderList(list);
    renderMarkers(list);
    el.count.textContent = `${list.length} 件`;
  }

  function renderList(list) {
    el.list.replaceChildren();
    if (list.length === 0) {
      el.list.append(create('li', 'empty', '該当するモールがありません。'));
      return;
    }
    for (const mall of list) {
      const li = create('li', 'mall-card');
      li.append(create('h3', '', mall.name));
      li.append(create('p', 'state', STATES[mall.state]));
      if (mall.description) li.append(create('p', 'desc', mall.description));

      const links = create('div', 'links');
      if (mall.url) links.append(externalLink(mall.url, '公式サイト'));
      links.append(externalLink(googleMapsUrl(mall), 'Google マップで開く'));
      li.append(links);

      const actions = create('div', 'actions');
      const focusBtn = create('button', 'btn small needs-map', '地図で見る');
      focusBtn.type = 'button';
      focusBtn.addEventListener('click', () => focusMall(mall.id));
      const delBtn = create('button', 'btn small danger', '削除');
      delBtn.type = 'button';
      delBtn.addEventListener('click', () => deleteMall(mall.id));
      actions.append(focusBtn, delBtn);
      li.append(actions);

      el.list.append(li);
    }
  }

  function renderMarkers(list) {
    if (!app.map) return;
    for (const marker of app.markers.values()) marker.map = null;
    app.markers.clear();
    app.infoWindow.close();

    for (const mall of list) {
      const marker = new app.AdvancedMarkerElement({
        map: app.map,
        position: { lat: mall.lat, lng: mall.lng },
        title: mall.name,
      });
      marker.addListener('click', () => openInfo(mall, marker));
      app.markers.set(mall.id, marker);
    }
  }

  function openInfo(mall, marker) {
    const box = create('div', 'info');
    box.append(create('h3', '', mall.name));
    box.append(create('p', 'state', STATES[mall.state]));
    if (mall.description) box.append(create('p', '', mall.description));
    if (mall.url) box.append(externalLink(mall.url, '公式サイト'));
    app.infoWindow.setContent(box);
    app.infoWindow.open({ anchor: marker, map: app.map });
  }

  function focusMall(id) {
    const mall = app.malls.find((m) => m.id === id);
    const marker = app.markers.get(id);
    if (!app.map || !mall || !marker) return;
    app.map.panTo({ lat: mall.lat, lng: mall.lng });
    app.map.setZoom(15);
    openInfo(mall, marker);
    el.map.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function deleteMall(id) {
    const mall = app.malls.find((m) => m.id === id);
    if (!mall) return;
    if (!confirm(`「${mall.name}」を削除しますか？`)) return;
    app.malls = app.malls.filter((m) => m.id !== id);
    saveMalls();
    render();
  }

  // ---------- 追加フォーム ----------
  function showError(message) {
    el.formError.textContent = message;
    el.formError.hidden = !message;
  }

  function validateForm() {
    const name = el.name.value.trim();
    if (!name) return 'モール名を入力してください。';
    if (name.length > LIMITS.name) return `モール名は ${LIMITS.name} 文字以内にしてください。`;
    if (!Object.hasOwn(STATES, el.state.value)) return '州・地域を選択してください。';
    if (el.desc.value.trim().length > LIMITS.description) return `紹介文は ${LIMITS.description} 文字以内にしてください。`;
    const url = el.url.value.trim();
    if (url && !safeUrl(url)) return 'URL は http:// または https:// で始まる正しい形式で入力してください。';
    if (el.lat.value.trim() === '' || el.lng.value.trim() === '') return '地図をクリックして場所を指定してください。';
    const lat = Number(el.lat.value);
    const lng = Number(el.lng.value);
    if (!isLat(lat) || !isLng(lng)) return '緯度・経度が正しくありません。';
    if (!inMalaysia(lat, lng)) return 'マレーシア国内の場所を指定してください。';
    return '';
  }

  function onSubmit(event) {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      showError(error);
      return;
    }
    const mall = toMall({
      id: newId(),
      name: el.name.value,
      state: el.state.value,
      description: el.desc.value,
      url: el.url.value.trim(),
      lat: el.lat.value,
      lng: el.lng.value,
    });
    if (!mall) {
      showError('入力内容を確認してください。');
      return;
    }
    app.malls.push(mall);
    if (!saveMalls()) {
      app.malls.pop();
      return;
    }
    el.form.reset(); // reset イベントでピンとエラーも消える
    // 追加したモールが絞り込みで隠れないように解除
    el.search.value = '';
    el.filterState.value = '';
    render();
    focusMall(mall.id);
  }

  // ---------- 新規追加用ピン ----------
  function readPosition(pos) {
    if (!pos) return null;
    const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
    const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
    return { lat, lng };
  }

  function setLatLngInputs(lat, lng) {
    el.lat.value = lat.toFixed(6);
    el.lng.value = lng.toFixed(6);
  }

  function placeDraftMarker(lat, lng) {
    if (!app.map) return;
    const position = { lat, lng };
    if (!app.draftMarker) {
      const pin = new app.PinElement({ background: '#e11d48', borderColor: '#9f1239', glyphColor: '#ffffff' });
      app.draftMarker = new app.AdvancedMarkerElement({
        map: app.map,
        position,
        content: pin.element || pin,
        gmpDraggable: true,
        title: '新しいモールの場所（ドラッグで移動できます）',
      });
      app.draftMarker.addListener('dragend', () => {
        const p = readPosition(app.draftMarker.position);
        if (p) setLatLngInputs(p.lat, p.lng);
      });
    } else {
      app.draftMarker.position = position;
      app.draftMarker.map = app.map;
    }
  }

  function clearDraftMarker() {
    if (app.draftMarker) app.draftMarker.map = null;
  }

  function onLatLngInput() {
    const lat = Number(el.lat.value);
    const lng = Number(el.lng.value);
    if (el.lat.value.trim() === '' || el.lng.value.trim() === '' || !isLat(lat) || !isLng(lng)) return;
    placeDraftMarker(lat, lng);
    if (app.map) app.map.panTo({ lat, lng });
  }

  // ---------- Google Maps 読み込み ----------
  function showMapMessage(message) {
    el.mapMessage.textContent = message;
    el.mapMessage.hidden = false;
  }

  async function initMap() {
    try {
      const { Map: GoogleMap, InfoWindow } = await google.maps.importLibrary('maps');
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');
      app.AdvancedMarkerElement = AdvancedMarkerElement;
      app.PinElement = PinElement;

      const cfg = window.APP_CONFIG || {};
      app.map = new GoogleMap(el.map, {
        center: MALAYSIA_CENTER,
        zoom: 6,
        mapId: cfg.MAP_ID || 'DEMO_MAP_ID',
        streetViewControl: false,
        mapTypeControl: false,
      });
      app.infoWindow = new InfoWindow();

      app.map.addListener('click', (e) => {
        if (e.placeId) e.stop(); // Google 既定の POI 情報ウィンドウを抑止
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setLatLngInputs(lat, lng);
        placeDraftMarker(lat, lng);
        showError('');
      });

      el.mapMessage.hidden = true;
      document.body.classList.add('map-ready');
      render();
    } catch (err) {
      console.error(err);
      showMapMessage('地図の初期化に失敗しました。緯度・経度を直接入力して追加することはできます。');
    }
  }

  function loadGoogleMaps() {
    const cfg = window.APP_CONFIG || {};
    const key = typeof cfg.GOOGLE_MAPS_API_KEY === 'string' ? cfg.GOOGLE_MAPS_API_KEY.trim() : '';
    if (!key || key === 'YOUR_API_KEY') {
      showMapMessage('Google Maps の API キーが設定されていません（js/config.js）。一覧と追加機能は利用できます。');
      return;
    }
    // Google Maps が呼び出すグローバル関数
    window.initMap = initMap;
    window.gm_authFailure = () => {
      showMapMessage('Google Maps の API キー認証に失敗しました。キーとリファラー制限を確認してください。');
    };

    const params = new URLSearchParams({
      key,
      callback: 'initMap',
      loading: 'async',
      v: 'weekly',
      language: 'ja',
      region: 'MY',
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => showMapMessage('Google Maps を読み込めませんでした。ネットワーク接続を確認してください。');
    document.head.append(script);
  }

  // ---------- 初期化 ----------
  function fillStateOptions(select) {
    for (const [code, label] of Object.entries(STATES)) {
      const opt = create('option', '', label);
      opt.value = code;
      select.append(opt);
    }
  }

  function init() {
    fillStateOptions(el.state);
    fillStateOptions(el.filterState);

    app.malls = loadMalls();

    el.form.addEventListener('submit', onSubmit);
    el.form.addEventListener('reset', () => {
      clearDraftMarker();
      showError('');
    });
    el.lat.addEventListener('change', onLatLngInput);
    el.lng.addEventListener('change', onLatLngInput);
    el.search.addEventListener('input', render);
    el.filterState.addEventListener('change', render);
    el.resetData.addEventListener('click', () => {
      if (!confirm('追加したモールをすべて削除し、サンプルデータに戻しますか？')) return;
      app.malls = sampleCopy();
      saveMalls();
      render();
    });

    render();
    loadGoogleMaps();
  }

  init();
})();
