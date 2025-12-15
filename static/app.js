const searchInput = document.getElementById('search');
const suggestions = document.getElementById('suggestions');
const resultsEl = document.getElementById('searchResults');
const recsEl = document.getElementById('recs');
const historyEl = document.getElementById('history');
const audio = document.getElementById('audio');
const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const thumb = document.getElementById('thumb');
const trendingBtn = document.getElementById('trendingBtn');
const prevBtn = document.getElementById('prev');
const playBtn = document.getElementById('play');
const nextBtn = document.getElementById('next');
const downloadBtn = document.getElementById('download');

let queue = [];
let index = -1;
let currentVideoId = null;

// Update play button icon based on audio state
audio.addEventListener('play', () => {
  playBtn.innerHTML = '<span class="pause-icon"></span>';
});

audio.addEventListener('pause', () => {
  playBtn.textContent = '▶';
});

// hide result + suggestion lists when playing
function hideLists(){
  if(resultsEl) resultsEl.style.display = "none";
  if(suggestions) suggestions.innerHTML = '';
}

// Debounce helper
function debounce(fn, delay=300){
  let t;
  return (...args)=> {
    clearTimeout(t);
    t = setTimeout(()=> fn(...args), delay);
  }
}

// -------- REAL-TIME SUGGESTIONS --------
async function fetchSearch(q){
  if(!q) {
    suggestions.innerHTML = '';
    return;
  }
  try {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}&limit=8`);
    const data = await res.json();
    renderSuggestions(data);
  } catch(e){
    console.warn("fetchSearch error", e);
  }
}
const debouncedSearch = debounce((q)=> fetchSearch(q), 250);

searchInput.addEventListener('input', (e)=> {
  const q = e.target.value.trim();
  if(!q){
    suggestions.innerHTML = '';
    return;
  }
  debouncedSearch(q);
});

// render small realtime suggestion list (no thumbnails)
function renderSuggestions(items){
  suggestions.innerHTML = '';
  if(!items || items.length===0) return;
  items.forEach(it=>{
    const div = document.createElement('div');
    div.className = 'suggest';
    div.textContent = it.title + ' — ' + (it.artists||[]).join(', ');
    div.addEventListener('click', ()=> {
      suggestions.innerHTML = '';
      searchInput.value = it.title;
      loadSearchResults([it]);
      playTrack(it);
    });
    suggestions.appendChild(div);
  });
}

// -------- FULL SEARCH (on Enter) --------
async function doSearch(q){
  if(!q) return;
  try {
    const res = await fetch(`/search?q=${encodeURIComponent(q)}&limit=20`);
    const data = await res.json();
    loadSearchResults(data);
  } catch(e){
    console.warn("doSearch error", e);
  }
}

searchInput.addEventListener('keydown', (e)=> {
  if(e.key === 'Enter'){
    e.preventDefault();
    doSearch(searchInput.value.trim());
    suggestions.innerHTML = '';
  }
});

// Helper function to get thumbnail URL
function getThumbnailUrl(item) {
  // First try to get from thumbnails array
  if(item.thumbnails && item.thumbnails.length > 0) {
    const lastThumb = item.thumbnails[item.thumbnails.length - 1];
    if(lastThumb && lastThumb.url) {
      return lastThumb.url;
    }
  }
  
  // Fallback: Generate thumbnail URL from videoId
  if(item.videoId) {
    return `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
  }
  
  // Final fallback
  return 'https://via.placeholder.com/55x55/1db954/ffffff?text=♪';
}

// -------- SEARCH RESULTS (simple list, no thumbnails) --------
function loadSearchResults(items){
  resultsEl.innerHTML = '';
  resultsEl.style.display = "block";

  (items || []).forEach(it=>{
    const imgUrl = getThumbnailUrl(it);
    
    const li = document.createElement('li');
    li.className = 'item thumb-item';
    li.innerHTML = `
      <img src="${imgUrl}" class="thumb-img" alt="${escapeHtml(it.title)}" onerror="this.src='https://via.placeholder.com/55x55/1db954/ffffff?text=♪'">
      <div class="info">
        <strong>${escapeHtml(it.title)}</strong>
        <div class="sub">${(it.artists||[]).join(', ')}</div>
      </div>
      <div>
        <button class="playbtn"><span class="play-icon">▶</span></button>
      </div>`;
    li.querySelector('.playbtn').addEventListener('click', ()=> {
      playTrack(it);
      hideLists(); // Close dropdown after playing
    });
    resultsEl.appendChild(li);
  });
}

// -------- TRENDING & RECS: compact thumb lists --------
function loadThumbListIntoResults(items){
  const leftResults = document.getElementById('results');
  if(!leftResults) return;
  
  leftResults.innerHTML = '';
  leftResults.style.display = "block";

  // Limit to first 10 items only
  const limitedItems = (items || []).slice(0, 10);

  limitedItems.forEach(it=>{
    const imgUrl = getThumbnailUrl(it);
    
    const li = document.createElement('li');
    li.className = 'item thumb-item';
    li.innerHTML = `
      <img src="${imgUrl}" class="thumb-img" alt="${escapeHtml(it.title)}" onerror="this.src='https://via.placeholder.com/55x55/1db954/ffffff?text=♪'">
      <div class="info">
        <strong>${escapeHtml(it.title)}</strong>
        <div class="sub">${(it.artists||[]).join(', ')}</div>
      </div>
      <div><button class="playbtn"><span class="play-icon">▶</span></button></div>`;
    li.querySelector('.playbtn').addEventListener('click', ()=> playTrack(it));
    leftResults.appendChild(li);
  });
}

// -------- PLAY TRACK --------
async function playTrack(item, skipQueue = false){
  if(!item || !item.videoId) return;

  hideLists();

  if(!skipQueue) {
    const exists = queue.findIndex(q => q.videoId === item.videoId);
    if(exists === -1) {
      queue.push(item);
      index = queue.length - 1;
    } else {
      index = exists;
    }
  }

  setNowPlaying(item);
  
  try {
    // Get direct audio URL from backend
    const res = await fetch(`/play?videoId=${encodeURIComponent(item.videoId)}`);
    const data = await res.json();
    
    if(data.url) {
      audio.src = data.url;
      await audio.play();
    } else {
      console.error('No audio URL received');
    }
  } catch(e) {
    console.warn('Play error:', e);
  }

  // update recommendations
  fetchRecs(item.videoId);
}

// set now playing UI
function setNowPlaying(item){
  titleEl.textContent = item.title || '';
  artistEl.textContent = (item.artists||[]).join(', ') || '';
  currentVideoId = item.videoId;
  
  // Use the same thumbnail helper function
  const imgUrl = getThumbnailUrl(item);
  thumb.src = imgUrl;
  
  // Add error handler for main thumbnail
  thumb.onerror = function() {
    this.src = 'https://via.placeholder.com/120x120/1db954/ffffff?text=♪';
  };
}

// -------- RECOMMENDATIONS --------
async function fetchRecs(videoId){
  recsEl.innerHTML = '<li>Loading...</li>';
  try {
    const res = await fetch(`/recommend?videoId=${encodeURIComponent(videoId)}`);
    const data = await res.json();
    
    // Shuffle the recommendations array
    const shuffled = shuffleArray(data);
    
    renderRecs(shuffled);
  } catch(e){
    recsEl.innerHTML = '<li>Error</li>';
    console.warn("fetchRecs error", e);
  }
}

// Shuffle array helper function
function shuffleArray(array) {
  const shuffled = [...array]; // Create a copy
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function renderRecs(items){
  recsEl.innerHTML = '';
  (items||[]).forEach(it=>{
    // Skip if this is the currently playing song
    if(it.videoId === currentVideoId) return;
    
    const imgUrl = getThumbnailUrl(it);
    
    console.log('Recommendation:', it.title, 'VideoID:', it.videoId, 'Thumbnail:', imgUrl); // Debug log
    
    const li = document.createElement('li');
    li.className = 'item thumb-item';
    li.innerHTML = `
      <img src="${imgUrl}" class="thumb-img" alt="${escapeHtml(it.title)}" onerror="this.src='https://via.placeholder.com/55x55/1db954/ffffff?text=♪'">
      <div class="info">
        <strong>${escapeHtml(it.title)}</strong>
        <div class="sub">${(it.artists||[]).join(', ')}</div>
      </div>
      <div><button class="playbtn"><span class="play-icon">▶</span></button></div>`;
    
    // Store the song data on the button for later use
    const playButton = li.querySelector('.playbtn');
    playButton.songData = it;
    playButton.addEventListener('click', ()=> playTrack(it));
    
    recsEl.appendChild(li);
  });
}

// -------- TRENDING BUTTON CLICK --------
trendingBtn.addEventListener('click', async ()=>{
  const leftResults = document.getElementById('results');
  if(!leftResults) return;
  
  leftResults.innerHTML = '<li>Loading trending...</li>';
  leftResults.style.display = "block";
  try {
    const res = await fetch('/trending');
    const data = await res.json();
    // Shuffle trending songs when Latest button is clicked
    const shuffledTrending = shuffleArray(data);
    loadThumbListIntoResults(shuffledTrending);
  } catch(e){
    leftResults.innerHTML = '<li>Error loading trending</li>';
    console.warn("trending error", e);
  }
});

// -------- Player controls --------
prevBtn.addEventListener('click', ()=> {
  if(index > 0){
    index--;
    const it = queue[index];
    if(it) {
      setNowPlaying(it);
      audio.src = `/play?videoId=${encodeURIComponent(it.videoId)}`;
      audio.play().catch(e=>console.warn(e));
      fetchRecs(it.videoId);
    }
  }
});

playBtn.addEventListener('click', ()=> {
  if(audio.paused) audio.play().catch(e=>console.warn(e));
  else audio.pause();
});

nextBtn.addEventListener('click', async ()=> {
  // First check if there's a next song in the queue
  if(index < queue.length - 1){
    index++;
    const it = queue[index];
    if(it){
      setNowPlaying(it);
      audio.src = `/play?videoId=${encodeURIComponent(it.videoId)}`;
      audio.play().catch(e=>console.warn(e));
      fetchRecs(it.videoId);
    }
  } else {
    // No more songs in queue, get recommendations and play the first one
    const currentRecs = Array.from(recsEl.querySelectorAll('.item'));
    if(currentRecs.length > 0) {
      // Get the first recommendation from the DOM
      const firstRecButton = currentRecs[0].querySelector('.playbtn');
      if(firstRecButton) {
        firstRecButton.click();
      }
    } else if(queue[index]) {
      // Fallback: fetch recommendations if list is empty
      try {
        const res = await fetch(`/recommend?videoId=${encodeURIComponent(queue[index].videoId)}`);
        const data = await res.json();
        if(data && data.length > 0) {
          const nextSong = data[0];
          queue.push(nextSong);
          index = queue.length - 1;
          setNowPlaying(nextSong);
          audio.src = `/play?videoId=${encodeURIComponent(nextSong.videoId)}`;
          audio.play().catch(e=>console.warn(e));
          fetchRecs(nextSong.videoId);
        }
      } catch(e){ 
        console.warn(e); 
      }
    }
  }
});

// -------- utilities --------
function escapeHtml(text){
  if(!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// -------- DOWNLOAD BUTTON --------
downloadBtn.addEventListener('click', ()=> {
  if(!currentVideoId) {
    showToast('No song is currently playing', 'error');
    return;
  }
  
  // Show download starting toast
  showToast('Starting download...', 'success');
  
  const downloadUrl = `/play?videoId=${encodeURIComponent(currentVideoId)}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${titleEl.textContent || 'song'}.mp3`;
  link.click();
});

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('downloadToast');
  const toastMessage = toast.querySelector('.toast-message');
  
  toastMessage.textContent = message;
  
  // Show toast
  toast.classList.add('show');
  
  // Hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// -------- initial load: trending into compact thumb list --------
(async ()=>{
  try {
    const res = await fetch('/trending');
    const data = await res.json();
    // Shuffle trending songs on initial load
    const shuffledTrending = shuffleArray(data);
    loadThumbListIntoResults(shuffledTrending);
  } catch(e){
    console.warn("initial trending load failed", e);
  }
})();
