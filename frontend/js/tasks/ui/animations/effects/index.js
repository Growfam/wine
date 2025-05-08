export * from './particles.js';
export * from './transitions.js';

// Додаткові іменовані експорти для зручності
export const Effects = {
  particles: require('./particles.js').default || require('./particles.js'),
  transitions: require('./transitions.js').default || require('./transitions.js'),
};
