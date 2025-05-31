// import HomePage from '../pages/home/home-page';
// import AboutPage from '../pages/about/about-page';

// const routes = {
//   '/': new HomePage(),
//   '/about': new AboutPage(),
// };

// export default routes;

import AboutPage from '../pages/about/about-page';
import HomePage from '../pages/home/home-page';
import AddStoryPresenter from '../presenter/AddStoryPresenter.js';
import LoginPresenter from '../presenter/LoginPresenter.js';
import RegisterPresenter from '../presenter/RegisterPresenter.js';
import StoriesListPresenter from '../presenter/StoriesListPresenter.js';
import StoryDetailPresenter from '../presenter/StoryDetailPresenter.js';
import Model from './model.js';
import { getActivePathname, parseActivePathname } from './url-parser.js';

const routes = {
  '/': new HomePage(),
  '/about': new AboutPage(),
  '/login': () => new LoginPresenter(Model).init(),
  '/register': () => new RegisterPresenter(Model).init(),
  '/stories': () => new StoriesListPresenter(Model).init(),
  '/stories/:id': (id) => new StoryDetailPresenter(Model, id).init(),
  '/add': () => new AddStoryPresenter(Model).init(),
};

function router() {
  const pathname = getActivePathname();  // Use utility to get active path
  const { resource, id } = parseActivePathname(pathname);  // Parse pathname to get resource and id
  
  console.log('Router:', { resource, id });

  const route = Object.keys(routes).find(r => {
    if (r.includes('/:id')) {
      return r.split('/:')[0] === `/${resource}`;
    }
    return r === `/${resource}`;
  });

  console.log('  matched route:', route);

  if (route) {
    routes[route](id);
  } else {
    console.warn('Route not found, redirect to /');
    location.hash = '/';
  }
}

function navigate() {
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      router();
    });
  } else {
    router();
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('load', navigate);

