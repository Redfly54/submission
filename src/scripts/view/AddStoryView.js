export default class AddStoryView {
  constructor() {
    this.app = document.getElementById('app');
    this._stream = null;  // Initialize stream property to null
  }

  cleanup() {
    // Check if there's a stream and stop it
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;  // Reset the stream after stopping it
    }
  }

  render(onSubmit, mapKey) {
    this.app.innerHTML = `
      <button id="backBtn">&larr; Back to list</button>
      <h2>Add New Story</h2>
      <form id="addForm">
        <div>
          <video id="video" aria-label="Live camera preview" autoplay playsinline width="300"></video>
          <button type="button" id="captureBtn">Capture Photo</button>
          <canvas id="canvas" role="img" aria-label="Captured photo preview" style="display:none;"></canvas>
        </div>

        <label for="desc">Description:</label>
        <textarea id="desc" name="description" rows="3" required></textarea>

        <!-- lokasi -->
        <fieldset>
          <legend>Select location on map</legend>
          <div id="map-add" style="width:100%;height:300px;"></div>
        </fieldset>

        <input type="hidden" id="lat" name="lat">
        <input type="hidden" id="lon" name="lon">

        <button type="submit">Submit</button>
      </form>
    `;

    document.getElementById('backBtn')
      .addEventListener('click', () => {
        location.hash = '/stories';
        this.cleanup();  // Ensure camera is stopped when navigating back
      });

    // 1) Setup kamera
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('captureBtn');
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => { 
        video.srcObject = stream; 
        this._stream = stream;  // Store the stream for later cleanup
      })
      .catch(console.error);

    captureBtn.addEventListener('click', () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.style.display = 'block';
      // Allow the camera to stay open for multiple captures
      // this._stream.getTracks().forEach(t => t.stop()); // Removed to keep the camera on
    });

    // 2) Inisialisasi peta
    maplibregl.accessToken = mapKey;
    const map = new maplibregl.Map({
      container: 'map-add',
      style: `https://api.maptiler.com/maps/streets/style.json?key=${mapKey}`,
      center: [106.8272, -6.1751],
      zoom: 5,
    });
    let marker;
    map.on('click', e => {
      const { lng, lat } = e.lngLat;
      if (marker) marker.remove();
      marker = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
      // Set lat and lon in hidden input fields
      document.querySelector('input[name="lat"]').value = lat;
      document.querySelector('input[name="lon"]').value = lng;
    });

    // 3) Submit form
    document.getElementById('addForm')
      .addEventListener('submit', e => {
        e.preventDefault(); // Prevents the default form submit
        const f = e.target;
        if (!canvas.toBlob) {
          alert('Browser Anda tidak mendukung toBlob');
          return;
        }

        // Only call onSubmit once
        canvas.toBlob(blob => {
          onSubmit({
            photo: new File([blob], 'capture.png', { type: 'image/png' }),
            description: f.description.value,
            lat: f.lat.value,
            lon: f.lon.value,
          });
        });
      });
       window.addEventListener('hashchange', () => {
      this.cleanup();  // Ensure the camera is stopped when URL hash changes
    });
    
  }
}
