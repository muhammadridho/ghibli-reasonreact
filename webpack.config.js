const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const ClosureCompilerPlugin = require('webpack-closure-compiler');
const StatsWriterPlugin = require('webpack-stats-plugin').StatsWriterPlugin;
const ManifestPlugin = require('webpack-manifest-plugin');
const ShakePlugin = require('webpack-common-shake').Plugin;
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const { GenerateSW } = require('workbox-webpack-plugin');
const rollupPluginNodeResolve = require('rollup-plugin-node-resolve');
const CopyPlugin = require('copy-webpack-plugin');

const prod = process.env.NODE_ENV == 'production';
const dev = !prod && process.env.DEV !== '0';
const analyze = process.env.NODE_ENV == 'analyze';
const useRollup = process.env.ROLLUP == '1';
const useShakePlugin = prod || process.env.SHAKE == '1';
const useClosureCompiler = process.env.CLOSURE === '1';

const prodBaseUrl = 'https://ghibli-reasonreact.netlify.com'

let publicUrl = '';
let publicPath = '/';
const templateHtml = path.join(__dirname, '/public/index.html');

const extractHTML = new HtmlWebpackPlugin({
  filename: 'index.html',
  favicon: path.join(__dirname, '/public/favicon.png'),
  template: templateHtml,
  inject: true,
  base: prod ? prodBaseUrl + publicPath : false,
  minify: {
    removeAttributeQuotes: true,
    collapseWhitespace: true,
    html5: true,
    minifyCSS: true,
    removeComments: true,
    removeEmptyAttributes: true
  },
  environment: process.env.NODE_ENV
})

module.exports = {
  context: __dirname,
  entry: {
    app: useRollup ? './lib/es6/src/index' : './lib/js/src/index'
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, './dist'),
    publicPath,
  },
  devServer: {
    contentBase: path.resolve(__dirname, 'public'),
    historyApiFallback: true
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src/'),
      director: 'director/build/director',
    },
  },
  module: {
    rules: [
      {
        test: /\.png$/,
        loader: 'file-loader',
      },
      {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
      },
      useRollup
        ? {
          test: /\.js$/,
          loader: 'rollup-loader',
          options: {
            plugins: [rollupPluginNodeResolve({ module: true })],
          },
        }
        : null,
    ].filter(Boolean),
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
  },
  plugins: [
    // Generate a manifest file which contains a mapping of all asset filenames
    // to their corresponding output file so that tools can pick it up without
    // having to parse `index.html`.
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(!dev ? 'production' : null),
        PUBLIC_URL: JSON.stringify(publicUrl),
      },
    }),
    useClosureCompiler
      ? new ClosureCompilerPlugin({
        compiler: {
          language_in: 'ECMASCRIPT6',
          language_out: 'ECMASCRIPT5',
        },
        concurrency: 3,
      })
      : null,
    prod ? new UglifyJsPlugin() : null,
    analyze
      ? new UglifyJsPlugin({
        uglifyOptions: {
          compress: {
            warnings: false,
          },
          output: {
            comments: /^\**!|^ [0-9]+ $|@preserve|@license/,
          },
        }
      })
      : null,
    true
      ? new CompressionPlugin({
        // asset: '[path].gz[query]',
        algorithm: 'gzip',
        test: /\.(js|css)$/,
        // threshold: 10240,
        // minRatio: 0.8,
      })
      : null,
    true
      ? new StatsWriterPlugin({
        filename: 'stats.json',
        fields: null,
        transform: function (data) {
          data.modules.forEach(function (m) {
            delete m.source;
          });
          delete data.children;
          return JSON.stringify(data, null, 2);
        },
      })
      : null,
    useShakePlugin ? new ShakePlugin() : null,
    extractHTML,
    new GenerateSW({
      navigateFallback: publicUrl + '/index.html',
    }),
    new CopyPlugin([
      { from: 'public/_redirects', to: '.' }
    ]),
    new ManifestPlugin({
      fileName: 'asset-manifest.json',
    }),
  ].filter(Boolean),
};