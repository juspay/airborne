export const started = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "first_time_setup",
  key: "started",
  value: {},
};

export const completed = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "first_time_setup",
  key: "completed",
  value: {},
};

export const init_with_local_config_versions = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "init_with_local_config_versions",
  value: { app_update_id: "<UUID>" },
};

export const release_config_fetch = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "release_config_fetch",
  value: {
    release_config_url: "<url>",
    status: 200,
    time_taken: "<time_taken>",
    app_update_id: "<UUID>",
  },
};

export const package_update_download_started = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "package_update_download_started",
  value: {
    package_version: "v6",
    app_update_id: "<UUID>",
  },
};

export const rc_version_updated = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "rc_version_updated",
  value: {
    new_rc_version: "2",
    app_update_id: "<UUID>",
  },
};

export const config_updated = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "config_updated",
  value: { new_config_version: "v1", app_update_id: "<UUID>" },
};

export const package_update_result = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "package_update_result",
  value: {
    result: "SUCCESS",
    package_version: "v6",
    time_taken: 282,
    app_update_id: "<UUID>",
  },
};

export const updated_resources = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "updated_resources",
  value: { resources: "[]", app_update_id: "<UUID>" },
};

export const lazy_package_update_info = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "lazy_package_update_info",
  value: { package_splits_download: "No updates in app", app_update_id: "<UUID>" },
};

export const end = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ota_update",
  key: "end",
  value: { time_taken: 319, app_update_id: "<UUID>" },
};

export const boot = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "info",
  label: "ApplicationManager",
  key: "boot",
  value: {
    release_config_version: "2",
    config_version: "v1",
    package_version: "v6",
    resource_versions: [],
    time_taken: 363,
  },
};

export const read_release_config_error = {
  category: "lifecycle",
  subCategory: "hyperota",
  level: "error",
  label: "ApplicationManager",
  key: "read_release_config_error",
  value: { error: "<Stack trace>" },
};
