/*
 *
 */

const globby = require('globby');
const mkdirp = require('mkdirp');
const { join, dirname } = require('path');
const {
  createReadStream,
  createWriteStream,
  access,
  constants: FS
} = require('fs');

const PROJECT_ROOT = process.env.MJC_CWD || process.cwd();
const LIB_FOLDER_PATH = process.env.MJC_LIB || 'lib';
const SOURCE_FOLDER_PATH = process.env.MJC_SRC || 'src';

async function ensureLibFolder() {
  return new Promise((resolve, reject) => {
    mkdirp(join(PROJECT_ROOT, LIB_FOLDER_PATH), (err) => {
      if (err) {
        reject({ message: 'Failed to create the lib folder.', path: LIB_FOLDER_PATH, cause: err});

        return;
      }

      resolve({ message: 'Library folder created.', path: LIB_FOLDER_PATH});
    })
  });
}

const regMichaelJackson = /\.mjs$/;

const createStreamsFromPath = (path) => new Promise((resolve, reject) => {
  const srcPath = join(PROJECT_ROOT, path);
  const dstPath = srcPath
    .replace(/\.js$/, '.mjs')
    .replace(`/${SOURCE_FOLDER_PATH}/`, `/${LIB_FOLDER_PATH}/`);

  access(dstPath, FS.F_OK, (err) => {
   if (err) {
     if (!regMichaelJackson.test(dstPath)) {
       reject({
         reason: 'Unexpected file extension'
       });

       return;
     }

     mkdirp(dirname(dstPath), (err) => {
       if (err) {
         reject({
           reason: 'Error creating folder.',
           path: dstPath,
           cause: err
         });

         return;
       }

       const readStream = createReadStream(srcPath);
       const writeStream = createWriteStream(dstPath);
       resolve({ readStream, writeStream });
     });
   }

    const readStream = createReadStream(srcPath);
    const writeStream = createWriteStream(dstPath);
    resolve({ readStream, writeStream });
  });
});

async function processPath(path) {
  const { readStream, writeStream } = await createStreamsFromPath(path);

  if (!readStream) {
    return Promise.reject({
      reason: 'Nothing to read.',
      path
    });
  }

  if (!writeStream) {
    return Promise.reject({
      reason: 'Nothing to write.',
      path
    });
  }

  readStream.pipe(writeStream);
  readStream.on('close', () => console.log(`read: ${path}.`));

  return new Promise((resolve, reject) => {
    readStream.on('error', (err) => reject({
      reason: 'Error reading from stream.',
      path,
      cause: err
    }));

    writeStream.on('close', () => setTimeout(resolve, 10));
    writeStream.on(
      'error',
      (err) => reject({
        reason: 'Error writing to stream.',
        path,
        cause: err
      })
    );
  });
}

async function run() {
  const { message } = await ensureLibFolder();

  console.log(message);

  const paths = await globby([
    join(SOURCE_FOLDER_PATH, '*.js'),
    join(SOURCE_FOLDER_PATH, '**/*.js')
  ]);

  if (!paths) {
    return Promise.resolve();
  }

  // noinspection JSUnresolvedFunction
  return Promise.all(paths.map(processPath));
}

module.exports = {
  run
};

