const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Run Metro transform workers in separate child processes instead of worker_threads
// sharing the main Node process memory space, preventing multi-GB heap growth and OOM crashes.
config.transformer = {
  ...config.transformer,
  unstable_workerThreads: false,
};

// Cap worker count so parallel Babel/React Compiler transforms stay fast without exhausting RAM.
config.maxWorkers = Math.min(config.maxWorkers ?? 4, 4);

module.exports = config;
