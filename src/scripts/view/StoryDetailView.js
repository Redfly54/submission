// js/view/StoryDetailView.js
export default class StoryDetailView {
  constructor() {
    this.app = document.getElementById('app');
  }

  render(story, mapKey) {
    this.app.innerHTML = `
      <button id="backBtn">&larr; Back to list</button>
      <h2>Story Detail</h2>
      <img src="${story.photoUrl}" alt="Foto Story" width="300" />
      <h3>${story.name}</h3>
      <p>${story.description}</p>
      <small>${new Date(story.createdAt).toLocaleString()}</small>
      <h4>Location</h4>
      <div id="map-detail" style="width:100%;height:300px;"></div>
    `;

    document.getElementById('backBtn')
      .addEventListener('click', () => location.hash = '/stories');

    // Inisialisasi peta
    maplibregl.accessToken = mapKey;
    const map = new maplibregl.Map({
      container: 'map-detail',
      style: `https://api.maptiler.com/maps/streets/style.json?key=${mapKey}`,
      center: story.lon && story.lat ? [story.lon, story.lat] : [106.8272, -6.1751],
      zoom: story.lon && story.lat ? 10 : 5,
    });

    if (story.lat && story.lon) {
      new maplibregl.Marker()
        .setLngLat([story.lon, story.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 })
          .setHTML(`<strong>${story.name}</strong><p>${story.description}</p>`))
        .addTo(map);
    }
  }
}
