const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  results: [],
  favorites: loadJSON('ditz-favorites', []),
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  isPlaying: false,
  requestId: 0,
};

const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.8;

const elements = {
  searchForm: $('#searchForm'),
  searchInput: $('#searchInput'),
  songGrid: $('#songGrid'),
  favoriteGrid: $('#favoriteGrid'),
  statusCard: $('#statusCard'),
  favoriteStatus: $('#favoriteStatus'),
  resultTitle: $('#resultTitle'),
  resultEyebrow: $('#resultEyebrow'),
  resultCount: $('#resultCount'),
  favoriteCount: $('#favoriteCount'),
  player: $('#player'),
  playerArtwork: $('#playerArtwork'),
  playerTitle: $('#playerTitle'),
  playerArtist: $('#playerArtist'),
  playerFavorite: $('#playerFavorite'),
  playButton: $('#playButton'),
  previousButton: $('#previousButton'),
  nextButton: $('#nextButton'),
  progressBar: $('#progressBar'),
  volumeBar: $('#volumeBar'),
  currentTime: $('#currentTime'),
  duration: $('#duration'),
  storeLink: $('#storeLink'),
  toast: $('#toast'),
  sidebar: $('.sidebar'),
};

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveFavorites() {
  localStorage.setItem('ditz-favorites', JSON.stringify(state.favorites));
  elements.favoriteCount.textContent = state.favorites.length;
}

function normalizeTrack(track) {
  return {
    id: String(track.trackId || `${track.artistName}-${track.trackName}`),
    title: track.trackName || 'Tanpa judul',
    artist: track.artistName || 'Artis tidak diketahui',
    album: track.collectionName || 'Single',
    artwork: (track.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
    preview: track.previewUrl || '',
    storeUrl: track.trackViewUrl || track.collectionViewUrl || '#',
    genre: track.primaryGenreName || 'Music',
    releaseDate: track.releaseDate || '',
    duration: track.trackTimeMillis || 30000,
  };
}

function isFavorite(trackId) {
  return state.favorites.some((track) => track.id === String(trackId));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function yearOf(date) {
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? year : '—';
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function renderSkeletons() {
  elements.statusCard.classList.add('hidden');
  elements.songGrid.innerHTML = Array.from({ length: 10 }, () => '<article class="song-card skeleton"></article>').join('');
}

function cardTemplate(track) {
  const saved = isFavorite(track.id);
  const active = state.currentTrack?.id === track.id;
  return `
    <article class="song-card ${active ? 'active-song' : ''}" data-id="${escapeHTML(track.id)}">
      <div class="artwork-wrap">
        <img src="${escapeHTML(track.artwork)}" alt="Sampul ${escapeHTML(track.title)}" loading="lazy" />
        <button class="card-play" data-action="play" aria-label="Putar ${escapeHTML(track.title)}">${active && state.isPlaying ? 'Ⅱ' : '▶'}</button>
      </div>
      <div class="card-topline">
        <div class="card-copy">
          <strong title="${escapeHTML(track.title)}">${escapeHTML(track.title)}</strong>
          <span title="${escapeHTML(track.artist)}">${escapeHTML(track.artist)}</span>
        </div>
        <button class="favorite-button ${saved ? 'saved' : ''}" data-action="favorite" aria-label="${saved ? 'Hapus dari' : 'Tambah ke'} favorit">${saved ? '♥' : '♡'}</button>
      </div>
      <div class="card-meta">
        <span title="${escapeHTML(track.genre)}">${escapeHTML(track.genre)}</span>
        <span>${yearOf(track.releaseDate)}</span>
      </div>
    </article>`;
}

function renderTracks(tracks, target = elements.songGrid) {
  target.innerHTML = tracks.map(cardTemplate).join('');
}

function renderFavorites() {
  saveFavorites();
  if (!state.favorites.length) {
    elements.favoriteGrid.innerHTML = '';
    elements.favoriteStatus.innerHTML = '<strong>Belum ada lagu favorit</strong>Tekan ikon hati pada lagu yang kamu suka.';
    elements.favoriteStatus.classList.remove('hidden');
    return;
  }
  elements.favoriteStatus.classList.add('hidden');
  renderTracks(state.favorites, elements.favoriteGrid);
}

function jsonpSearch(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `ditzCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Permintaan terlalu lama'));
    }, 10000);

    window[callbackName] = (data) => {
      clearTimeout(timeout);
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Gagal memuat API'));
    };
    script.src = `${url}&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function fetchSongs(query) {
  const params = new URLSearchParams({ term: query, limit: '30', country: 'ID' });
  try {
    const response = await fetch(`/api/search?${params}`);
    if (!response.ok) throw new Error('Proxy gagal');
    return await response.json();
  } catch {
    const endpoint = `https://itunes.apple.com/search?${params}&media=music&entity=song&explicit=No`;
    return jsonpSearch(endpoint);
  }
}

async function searchSongs(query, options = {}) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const requestId = ++state.requestId;
  renderSkeletons();
  elements.resultEyebrow.textContent = options.eyebrow || 'HASIL PENCARIAN';
  elements.resultTitle.textContent = options.title || `“${cleanQuery}”`;
  elements.resultCount.textContent = '';

  try {
    const data = await fetchSongs(cleanQuery);
    if (requestId !== state.requestId) return;

    state.results = (data.results || [])
      .filter((item) => item.previewUrl && item.kind === 'song')
      .map(normalizeTrack);

    if (!state.results.length) {
      elements.songGrid.innerHTML = '';
      elements.statusCard.innerHTML = '<strong>Lagu tidak ditemukan</strong>Coba kata kunci lain, misalnya nama artis atau judul lagu.';
      elements.statusCard.classList.remove('hidden');
      return;
    }

    elements.statusCard.classList.add('hidden');
    elements.resultCount.textContent = `${state.results.length} lagu`;
    renderTracks(state.results);
  } catch (error) {
    if (requestId !== state.requestId) return;
    elements.songGrid.innerHTML = '';
    elements.statusCard.innerHTML = `<strong>Gagal mengambil musik</strong>${escapeHTML(error.message || 'Periksa koneksi internet lalu coba lagi.')}`;
    elements.statusCard.classList.remove('hidden');
  }
}

function findTrack(trackId, sourceGrid) {
  const source = sourceGrid === elements.favoriteGrid ? state.favorites : state.results;
  return { track: source.find((item) => item.id === trackId), queue: source };
}

function playTrack(track, queue = state.results) {
  if (!track?.preview) {
    showToast('Preview lagu ini tidak tersedia.');
    return;
  }

  const sameTrack = state.currentTrack?.id === track.id;
  if (sameTrack && !audio.paused) {
    audio.pause();
    return;
  }

  if (!sameTrack) {
    state.currentTrack = track;
    state.queue = queue;
    state.currentIndex = Math.max(0, queue.findIndex((item) => item.id === track.id));
    audio.src = track.preview;
    elements.playerArtwork.src = track.artwork;
    elements.playerArtwork.alt = `Sampul ${track.title}`;
    elements.playerTitle.textContent = track.title;
    elements.playerArtist.textContent = track.artist;
    elements.storeLink.href = track.storeUrl;
    elements.player.classList.remove('hidden');
    updatePlayerFavorite();
  }

  audio.play().catch(() => showToast('Browser memblokir audio. Tekan play sekali lagi.'));
}

function toggleFavorite(track) {
  const index = state.favorites.findIndex((item) => item.id === track.id);
  if (index >= 0) {
    state.favorites.splice(index, 1);
    showToast('Dihapus dari favorit');
  } else {
    state.favorites.unshift(track);
    showToast('Disimpan ke favorit');
  }
  saveFavorites();
  renderTracks(state.results);
  renderFavorites();
  updatePlayerFavorite();
}

function updatePlayerFavorite() {
  if (!state.currentTrack) return;
  const saved = isFavorite(state.currentTrack.id);
  elements.playerFavorite.textContent = saved ? '♥' : '♡';
  elements.playerFavorite.classList.toggle('saved', saved);
}

function playOffset(offset) {
  if (!state.queue.length) return;
  const nextIndex = (state.currentIndex + offset + state.queue.length) % state.queue.length;
  playTrack(state.queue[nextIndex], state.queue);
}

function handleGridClick(event) {
  const card = event.target.closest('.song-card');
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!card || !action) return;

  const { track, queue } = findTrack(card.dataset.id, event.currentTarget);
  if (!track) return;
  if (action === 'play') playTrack(track, queue);
  if (action === 'favorite') toggleFavorite(track);
}

function switchView(viewName) {
  $$('.view').forEach((view) => view.classList.remove('active-view'));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  $(`#${viewName}View`).classList.add('active-view');
  elements.sidebar.classList.remove('open');
  if (viewName === 'favorites') renderFavorites();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

elements.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  switchView('home');
  searchSongs(elements.searchInput.value);
});

elements.songGrid.addEventListener('click', handleGridClick);
elements.favoriteGrid.addEventListener('click', handleGridClick);

elements.playButton.addEventListener('click', () => {
  if (!state.currentTrack) return;
  if (audio.paused) audio.play(); else audio.pause();
});
elements.previousButton.addEventListener('click', () => playOffset(-1));
elements.nextButton.addEventListener('click', () => playOffset(1));
elements.playerFavorite.addEventListener('click', () => state.currentTrack && toggleFavorite(state.currentTrack));

elements.progressBar.addEventListener('input', () => {
  if (audio.duration) audio.currentTime = (Number(elements.progressBar.value) / 100) * audio.duration;
});
elements.volumeBar.addEventListener('input', () => { audio.volume = Number(elements.volumeBar.value); });

audio.addEventListener('play', () => {
  state.isPlaying = true;
  elements.playButton.textContent = 'Ⅱ';
  renderTracks(state.results);
  renderFavorites();
});
audio.addEventListener('pause', () => {
  state.isPlaying = false;
  elements.playButton.textContent = '▶';
  renderTracks(state.results);
  renderFavorites();
});
audio.addEventListener('timeupdate', () => {
  const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  elements.progressBar.value = String(progress);
  elements.currentTime.textContent = formatTime(audio.currentTime);
  elements.duration.textContent = formatTime(audio.duration || 30);
});
audio.addEventListener('ended', () => playOffset(1));
audio.addEventListener('error', () => showToast('Preview gagal diputar. Coba lagu lain.'));

$$('.chip').forEach((chip) => chip.addEventListener('click', () => {
  $$('.chip').forEach((item) => item.classList.remove('active'));
  chip.classList.add('active');
  elements.searchInput.value = '';
  searchSongs(chip.dataset.query, { eyebrow: 'PILIHAN MOOD', title: chip.textContent });
}));

$$('.nav-item').forEach((item) => item.addEventListener('click', () => switchView(item.dataset.view)));
$('#mobileMenuButton').addEventListener('click', () => elements.sidebar.classList.toggle('open'));
$('#exploreButton').addEventListener('click', () => elements.searchInput.focus());
$('#randomButton').addEventListener('click', () => {
  if (!state.results.length) return;
  playTrack(state.results[Math.floor(Math.random() * state.results.length)], state.results);
});
$('#themeButton').addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('ditz-theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
});

document.addEventListener('click', (event) => {
  if (window.innerWidth <= 920 && elements.sidebar.classList.contains('open') && !event.target.closest('.sidebar') && !event.target.closest('#mobileMenuButton')) {
    elements.sidebar.classList.remove('open');
  }
});

if (localStorage.getItem('ditz-theme') === 'light') document.documentElement.classList.add('light');
saveFavorites();
renderFavorites();
searchSongs('Indonesia hits', { eyebrow: 'SEDANG TRENDING', title: 'Pilihan buat kamu' });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
