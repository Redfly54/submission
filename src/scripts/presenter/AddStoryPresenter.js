// import { loadConfig } from '../utils/index.js';
// import AddStoryView from '../view/AddStoryView.js';

// export default class AddStoryPresenter {
//   constructor(model) {
//     this.model = model;
//     this.view  = new AddStoryView();
//   }

//   async init() {

//     if (!this.model.token) {
//         alert('Anda harus login terlebih dahulu');
//         return location.hash = '/login';
//     }
    
//     try {
//       const { maptilerKey } = await loadConfig();
//       this.view.render(async ({ photo, description, lat, lon }) => {
//         try {
//           await this.model.addStory({ photo, description, lat, lon });
//           alert('Story berhasil ditambahkan!');
//           location.hash = '/stories';
//         } catch (err) {
//           alert(`Gagal submit: ${err.message}`);
//         }
//       }, maptilerKey);
//     } catch (err) {
//       alert(`Gagal load konfigurasi: ${err.message}`);
//     }
//   }
// }

import AddStoryModel from '../model/AddStoryModel.js';
import { loadConfig } from '../utils/index.js';
import AddStoryView from '../view/AddStoryView.js';

export default class AddStoryPresenter {
  constructor() {
    this.model = new AddStoryModel();  // Use AddStoryModel to handle the API
    this.view = new AddStoryView();    // Use AddStoryView for the view rendering
  }

  async init() {
    // Check if the user is logged in by checking the token
    if (!this.model.token) {
      alert('Anda harus login terlebih dahulu');
      return location.hash = '/login';  // Redirect to login if no token is found
    }

    try {
      // Load configuration data (e.g., Maptiler API key)
      const { maptilerKey } = await loadConfig();
      
      // Render the view and pass the maptilerKey to it
      this.view.render(async ({ photo, description, lat, lon }) => {
        try {
          // Call the model to add the story
          await this.model.addStory({ photo, description, lat, lon });
          alert('Story berhasil ditambahkan!');
          location.hash = '/stories';  // Redirect to stories page after successful submission
        } catch (err) {
          alert(`Gagal submit: ${err.message}`);  // Handle errors if the submission fails
        }
      }, maptilerKey);
    } catch (err) {
      alert(`Gagal load konfigurasi: ${err.message}`);  // Handle errors if config loading fails
    }
  }
}
