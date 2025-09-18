const fs = require('fs');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
    serializer: {
        createModuleIdFactory: function () {
            // map of module paths to their Ids
            const fileToIdMap = {};

            const projectRootPath = __dirname;
            let nextId = 0;

            // create fileToIdMap file so that it can be used in metro.business.config
            const MAP_FILE = 'fileToIdMap.txt';
            if (fs.existsSync(MAP_FILE)) {
                // delete file if exists
                fs.unlinkSync(MAP_FILE);
            }
            return function (path) {
                // Based on the relative path of the file
                const modulePath = path.substr(projectRootPath.length + 1);

                let moduleId = fileToIdMap[modulePath];
                if (typeof moduleId !== 'number') {
                moduleId = nextId++;
                fileToIdMap[modulePath] = moduleId;
                fs.appendFileSync(MAP_FILE, `${modulePath}:${moduleId}\n`);
                }
                return moduleId;
            };
        },
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);



