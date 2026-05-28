(function () {
  function initTheme() {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    document.getElementById('theme-toggle').addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon(next);
    });
  }

  function updateThemeIcon(theme) {
    document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  const CATEGORY_COLORS = {
    bakery: '#e65100',
    patisserie: '#c2185b',
    chocolatier: '#4e342e',
    'ice-cream': '#00838f',
    specialty: '#7b1fa2',
    restaurant: '#1565c0'
  };

  let map, userMarker, userLatLng, allPlaces = [], collections = [], markers = [];
  let locationIndex = [];
  let activeCollections = new Set();

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + ' m';
    return (meters / 1000).toFixed(1) + ' km';
  }

  function createMarkerIcon(category) {
    const color = CATEGORY_COLORS[category] || '#888';
    return L.divIcon({
      className: '',
      html: '<div style="' +
        'width:28px;height:28px;border-radius:50%;background:' + color + ';' +
        'border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);' +
        '"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16]
    });
  }

  function buildPopupContent(place) {
    let html = '<strong>' + place.name + '</strong><br>' +
      '<span style="color:#666">' + place.address + ' (' + place.arrondissement + ')</span><br>';
    if (place._distance != null) {
      html += '<span class="popup-distance">' + formatDistance(place._distance) + '</span><br>';
    }
    html += '<em>' + place.description + '</em>';
    return html;
  }

  function getVisiblePlaces() {
    return allPlaces.filter(p => activeCollections.has(p._collectionName));
  }

  function renderList() {
    const list = document.getElementById('shop-list');
    const count = document.getElementById('shop-count');
    const sorted = [...getVisiblePlaces()];

    if (userLatLng) {
      sorted.forEach(p => {
        p._distance = haversine(userLatLng.lat, userLatLng.lng, p.lat, p.lng);
      });
      sorted.sort((a, b) => a._distance - b._distance);
    }

    count.textContent = sorted.length + ' places' +
      (userLatLng ? ' (sorted by distance)' : '');

    list.innerHTML = sorted.map((p, i) => {
      let distHtml = '';
      if (p._distance != null) {
        distHtml = '<span class="shop-distance">' + formatDistance(p._distance) + '</span>';
      }
      return '<div class="shop-card" data-index="' + i + '" data-lat="' + p.lat + '" data-lng="' + p.lng + '">' +
        '<div class="shop-card-header">' +
          '<span class="shop-name">' + p.name + '</span>' +
          '<span class="shop-category cat-' + p.category + '">' + p.category + '</span>' +
        '</div>' +
        '<div class="shop-address">' + p.address + ' (' + p.arrondissement + ')</div>' +
        distHtml +
        '<div class="shop-desc">' + p.description + '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.shop-card').forEach(card => {
      card.addEventListener('click', function () {
        const lat = parseFloat(this.dataset.lat);
        const lng = parseFloat(this.dataset.lng);
        map.setView([lat, lng], 16);
        const marker = markers.find(m => {
          const pos = m.getLatLng();
          return Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001;
        });
        if (marker) marker.openPopup();
      });
    });
  }

  function updateMarkerPopups() {
    markers.forEach(m => {
      const place = m._placeData;
      if (userLatLng) {
        place._distance = haversine(userLatLng.lat, userLatLng.lng, place.lat, place.lng);
      }
      m.setPopupContent(buildPopupContent(place));
    });
  }

  function onLocationFound(pos) {
    userLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    if (!userMarker) {
      userMarker = L.marker([userLatLng.lat, userLatLng.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="' +
            'width:18px;height:18px;border-radius:50%;background:#4285f4;' +
            'border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);' +
            '"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        }),
        zIndexOffset: 1000
      }).addTo(map);
    } else {
      userMarker.setLatLng([userLatLng.lat, userLatLng.lng]);
    }

    updateMarkerPopups();
    renderList();
  }

  function onLocationError(err) {
    if (err.code === 1) {
      alert('Location access denied. Please enable location permissions.');
    } else {
      alert('Could not determine your location.');
    }
    document.getElementById('locate-btn').classList.remove('active');
  }

  function updateCollectionsToggleLabel() {
    var btn = document.getElementById('collections-toggle');
    var count = activeCollections.size;
    var total = collections.length;
    btn.textContent = 'Collections (' + count + '/' + total + ')';
  }

  function renderCollections() {
    var dropdown = document.getElementById('collections-dropdown');
    dropdown.innerHTML = collections.map(function (c) {
      var checked = activeCollections.has(c.name);
      var linkHtml = c.sourceUrl
        ? '<a class="collection-link" href="' + c.sourceUrl + '" target="_blank" rel="noopener" title="View source">↗</a>'
        : '';
      return '<div class="collection-row" data-collection="' + c.name + '">' +
        '<div class="collection-check' + (checked ? ' checked' : '') + '"></div>' +
        '<div class="collection-info">' +
          '<div class="collection-name">' + c.name + '</div>' +
          '<div class="collection-count">' + c.places.length + ' places</div>' +
        '</div>' +
        linkHtml +
      '</div>';
    }).join('');

    dropdown.querySelectorAll('.collection-row').forEach(function (row) {
      var check = row.querySelector('.collection-check');
      check.addEventListener('click', function (e) {
        e.stopPropagation();
        var name = row.dataset.collection;
        if (activeCollections.has(name)) {
          if (activeCollections.size > 1) {
            activeCollections.delete(name);
          }
        } else {
          activeCollections.add(name);
        }
        renderCollections();
        updateCollectionsToggleLabel();
        refreshView();
      });
    });

    updateCollectionsToggleLabel();
  }

  function initCollectionsDropdown() {
    var toggle = document.getElementById('collections-toggle');
    var dropdown = document.getElementById('collections-dropdown');

    toggle.addEventListener('click', function () {
      var isOpen = !dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden');
      toggle.classList.toggle('open');
      if (isOpen) return;
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#collections-bar')) {
        dropdown.classList.add('hidden');
        toggle.classList.remove('open');
      }
    });
  }

  function refreshView() {
    clearMarkers();
    addMarkers(getVisiblePlaces());
    updateMarkerPopups();
    renderList();
  }

  function clearMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
  }

  function addMarkers(places) {
    places.forEach(place => {
      if (!place.lat || !place.lng) return;
      const marker = L.marker([place.lat, place.lng], {
        icon: createMarkerIcon(place.category)
      }).addTo(map);
      marker._placeData = place;
      marker.bindPopup(buildPopupContent(place));
      markers.push(marker);
    });
  }

  async function loadLocation(loc) {
    const res = await fetch(loc.file);
    const data = await res.json();

    collections = data.collections;
    activeCollections = new Set(collections.map(c => c.name));
    allPlaces = collections.flatMap(c =>
      c.places.map(p => Object.assign({}, p, { _source: c.source, _collectionName: c.name }))
    );

    map.setView(data.center, data.zoom);
    clearMarkers();
    addMarkers(allPlaces);
    renderCollections();
    renderList();

    document.getElementById('loading').style.display = 'none';
  }

  function initMap() {
    map = L.map('map').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
  }

  async function init() {
    initTheme();
    initCollectionsDropdown();
    initMap();

    try {
      const res = await fetch('data/index.json');
      const index = await res.json();
      locationIndex = index.locations;

      const select = document.getElementById('city-select');
      locationIndex.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.id;
        opt.textContent = loc.name;
        select.appendChild(opt);
      });

      select.addEventListener('change', function () {
        const loc = locationIndex.find(l => l.id === this.value);
        if (loc) loadLocation(loc);
      });

      await loadLocation(locationIndex[0]);
    } catch (err) {
      document.getElementById('loading').textContent = 'Failed to load data.';
    }

    let watchId = null;
    document.getElementById('locate-btn').addEventListener('click', function () {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        this.classList.remove('active');
        return;
      }

      this.classList.add('active');
      watchId = navigator.geolocation.watchPosition(onLocationFound, onLocationError, {
        enableHighAccuracy: true,
        maximumAge: 10000
      });
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  init();
})();
