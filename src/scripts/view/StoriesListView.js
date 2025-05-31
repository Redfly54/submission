// js/view/StoriesListView.js
export default class StoriesListView {
  constructor() {
    this.app = document.getElementById('app');
  }

   cleanup() {
    // Check if there's a stream and stop it
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;  // Reset the stream after stopping it
    }
  }

  render(stories, mapKey) {
    this.app.innerHTML = `
      <h2>All Stories</h2>
      <div id="stories-list" class="stories-grid"></div>
      <h3>Map</h3>
      <div id="map-list" style="width:100%;height:400px;"></div>
    `;

    // 1) Render daftar cerita
    const listEl = document.getElementById('stories-list');
    stories.forEach(s => {
      const item = document.createElement('div');
      item.className = 'story-item';
      item.innerHTML = `
        <img src="${s.photoUrl}" alt="Foto Story" width="200" />
        <h4>${s.name}</h4>
        <p>${s.description}</p>
        <small>${new Date(s.createdAt).toLocaleString()}</small>
      `;
      listEl.appendChild(item);
    });

    // 2) Inisialisasi peta MapTiler via MapLibre GL JS
    maplibregl.accessToken = mapKey;
    const map = new maplibregl.Map({
      container: 'map-list',
      style: `https://api.maptiler.com/maps/streets/style.json?key=${mapKey}`,
      center: [106.8272, -6.1751],
      zoom: 5,
    });

    // 3) Pasang marker + popup
    // stories.forEach(s => {
    //   if (s.lat && s.lon) {
    //     new maplibregl.Marker()
    //       .setLngLat([s.lon, s.lat])
    //       .setPopup(new maplibregl.Popup({ offset: 25 })
    //         .setHTML(`
    //           <strong>${s.name}</strong><br>
    //           ${s.description}<br>
    //           <img src="${s.photoUrl}" width="100" />
    //         `))
    //       .addTo(map);
    //   }
    // });

    // js/view/StoriesListView.js
    // stories.forEach(s => {
    //   const item = document.createElement('article');
    //   item.className = 'story-item';
    //   item.innerHTML = `
    //     <img src="${s.photoUrl}"
    //         alt="Foto oleh ${s.name}: ${s.description.substring(0, 30)}…"
    //         width="200" />
    //     <h2>${s.name}</h2>
    //     <p>${s.description}</p>
    //     <time datetime="${s.createdAt}">
    //       ${new Date(s.createdAt).toLocaleString()}
    //     </time>
    //   `;
    //   listEl.appendChild(item);
    // });
    let marker;
    // Add markers for each story on the map
    stories.forEach(s => {
      const { lat, lon } = s;
      if (lat && lon) {
        marker = new maplibregl.Marker()
          .setLngLat([lon, lat])
          .addTo(map);

        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(`
            <strong>${s.name}</strong><br>
            ${s.description}<br>
            <img src="${s.photoUrl}" width="100" />
          `);
        
        marker.setPopup(popup);
      }
    });

  }
}
