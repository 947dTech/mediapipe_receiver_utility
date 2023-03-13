const path = require('path');

module.exports = {
  entry: {
    online_player: './src/online_player.js',
    offline_player: './src/offline_player.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
