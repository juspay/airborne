"use client";
import { View } from "@/app/dashboard/[orgId]/[appId]/views/page";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import React, { useEffect, useState } from "react";

interface ViewReleaseInfo {
  view: View;
}

interface ReleaseResponse {
  id: string;
  created_at: string;
  config: {
    boot_timeout: number;
    package_timeout: number;
  };
  package: {
    version: number;
    index: {
      file_path: string;
      url: string;
      checksum: string;
    };
    properties: Record<string, unknown>;
    important: {
      file_path: string;
      url: string;
      checksum: string;
    }[];
    lazy: any[];
  };
  resources: any[];
  experiment: {
    experiment_id: string;
    package_version: number;
    config_version: string;
    created_at: string;
    traffic_percentage: number;
    status: string;
  };
}

const demoRelease = {
  id: "7368578018081640448",
  created_at: "2025-09-02T09:38:21.126Z",
  config: { boot_timeout: 4000, package_timeout: 4000 },
  package: {
    version: 0,
    index: {
      file_path: "/dist/bundle.js",
      url: "https://assets.juspay.in/api/mpm/bigbasket.json",
      checksum:
        "4084cc70aab36188b520c98dd18cc3528175c010999948f41da73664b4703e0e",
    },
    properties: {},
    important: [
      {
        file_path: "dist/app.json",
        url: "https://airborne.sandbox.juspay.in/assets/airborne-react-example/ios/1/main.jsbundle",
        checksum:
          "6aae20d099c2935adce57afa6b7b23009e2a6f6888b9d271eae2a0aeb932bdf5",
      },
    ],
    lazy: [],
  },
  resources: [],
  experiment: {
    experiment_id: "7368578018081640448",
    package_version: 0,
    config_version: "v0",
    created_at: "2025-09-02T09:38:21.126Z",
    traffic_percentage: 0,
    status: "CREATED",
  },
};

const ViewReleaseInfo: React.FC<ViewReleaseInfo> = ({ view }) => {
  const [release, setRelease] = useState<ReleaseResponse | null>(null);
  const { token, org, app } = useAppContext();
  const [loading, setLoading] = useState<boolean>(true);

  const dimensionHeader = view.dimensions
    .map((d) => `${d.key}=${d.value}`)
    .join(";");

  const fetchRelease = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/releases/${org}/${app}`,
        {
          headers: {
            "x-dimension": dimensionHeader,
          },
        },
        { token, org, app }
      );
      setRelease(res);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && org && app) {
      fetchRelease();
    }
  }, [token, org, app]);
  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg">
        <p>Loading release info...</p>
      </div>
    );
  }
  const hasRelease = release?.id;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
      {!hasRelease ? (
        <p className="text-gray-600 dark:text-gray-300">No release yet</p>
      ) : (
        <div className="space-y-2">
          {/* Package version quick info */}
          <div className="mt-2 text-sm text-gray-700">
            <p>Package Version: {release?.package.version}</p>
          </div>

          {/* Render config JSON */}
          <div className="mt-3">
            <h4 className="font-medium text-gray-800">Config</h4>
            <pre className="bg-gray-100 text-black text-xs rounded-md p-3 overflow-x-auto">
              {JSON.stringify(release?.config, null, 2)}
            </pre>
          </div>

          {/* Render package JSON */}
          <div className="mt-3">
            <h4 className="font-medium text-gray-800">Package</h4>
            <pre className="bg-gray-100 text-black text-xs rounded-md p-3 overflow-x-auto">
              {JSON.stringify(release?.package, null, 2)}
            </pre>
          </div>

          {/* Render resources JSON */}
          <div className="mt-3">
            <h4 className="font-medium text-gray-800">Resources</h4>
            <pre className="bg-gray-100 text-black text-xs rounded-md p-3 overflow-x-auto">
              {JSON.stringify(release?.resources, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewReleaseInfo;
