export const releaseConfig = {
  "version": "1",
  "config": {
    "version": "1.0.0",
    "release_config_timeout": 1000,
    "boot_timeout": 1000,
    "properties": {}
  },
  "package": {
    "name": "Application_Name",
    "version": "1.0.0",
    "index": {
        "url": "https://assets.juspay.in/bundles/index.js",
        "filePath": "index.js"
      },
    "properties": {},
    "important": [
      {
        "url": "https://assets.juspay.in/bundles/initial.js",
        "filePath": "initial.js"
      }
    ],
    "lazy": [
      {
        "url": "https://assets.juspay.in/images/card.png",
        "filePath": "card.png"
      }
    ]
  },
  "resources": [
    {
      "url": "https://assets.juspay.in/configs/config.js",
      "filePath": "config.js"
    }
  ]
};
