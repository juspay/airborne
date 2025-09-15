"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, Download, Eye, XCircle, Database, ChevronRight, ChevronDown, ExternalLink, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { ConfigPreviewProps, ListPropertiesResponse, PropertyEntry } from "@/types/remote-configs";
import { generateJsonSchema } from "./utils/helpers";

interface PropertyCardProps {
  property: PropertyEntry;
  index: number;
}

function PropertyCard({ property, index }: PropertyCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showJsonView, setShowJsonView] = useState(false);
  const { toast } = useToast();
  const { org, app } = useAppContext();

  const copyToClipboard = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: `${label} has been copied to your clipboard.`,
      });
    } catch (err) {
      console.log("Failed to copy to clipboard", err);
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy to clipboard. Please try again.",
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toUpperCase()) {
      case "DEFAULT":
        return "default";
      case "CREATED":
        return "secondary";
      case "INPROGRESS":
        return "default";
      case "CONCLUDED":
        return "outline";
      case "DISCARDED":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "DEFAULT":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CREATED":
        return "bg-green-100 text-green-800 border-green-200";
      case "INPROGRESS":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CONCLUDED":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "DISCARDED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const dimensionsCount = Object.keys(property.dimensions).length;
  const propertiesCount = Object.keys(property.properties).length;

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg">Property Set #{index + 1}</CardTitle>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>{dimensionsCount} dimensions</span>
                    <span>•</span>
                    <span>{propertiesCount} properties</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(property.status)} className={getStatusColor(property.status)}>
                  {property.status}
                </Badge>
                <Link
                  href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(property.experiment_id)}`}
                  className="ml-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="sm" variant="outline" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    View Release
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Dimensions Section */}
              {dimensionsCount > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">Dimensions ({dimensionsCount})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(property.dimensions).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="font-medium text-sm">{key}</span>
                        <Badge variant="outline" className="text-xs">
                          {typeof value === "string" ? value : JSON.stringify(value)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Release ID */}
              <div>
                <h4 className="font-medium mb-2">Release ID</h4>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">{property.experiment_id}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(property.experiment_id, "Release ID")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Properties Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Properties ({propertiesCount})</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowJsonView(!showJsonView)}
                      className="gap-1"
                    >
                      {showJsonView ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showJsonView ? "Visual" : "JSON"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(JSON.stringify(property.properties, null, 2), "Properties")}
                      className="gap-1"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>

                {propertiesCount > 0 ? (
                  showJsonView ? (
                    <div className="relative">
                      <ScrollArea className="w-full max-h-96">
                        <pre className="text-sm p-4 bg-muted rounded-lg overflow-auto font-mono">
                          <code className="text-foreground whitespace-pre">
                            {JSON.stringify(property.properties, null, 2)}
                          </code>
                        </pre>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="space-y-2">{renderPropertiesVisual(property.properties)}</div>
                  )
                ) : (
                  <div className="text-center py-4 text-muted-foreground">No properties configured</div>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function renderPropertiesVisual(properties: any, depth = 0): React.ReactNode {
  if (typeof properties !== "object" || properties === null) {
    return <span className="text-sm">{typeof properties === "string" ? `"${properties}"` : String(properties)}</span>;
  }

  if (Array.isArray(properties)) {
    return (
      <div className={`space-y-1 ${depth > 0 ? "ml-4" : ""}`}>
        {properties.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground mt-0.5">[{index}]</span>
            <div className="flex-1">{renderPropertiesVisual(item, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${depth > 0 ? "ml-4" : ""}`}>
      {Object.entries(properties).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="font-medium text-sm min-w-0 flex-shrink-0">{key}:</span>
          <div className="flex-1 min-w-0">{renderPropertiesVisual(value, depth + 1)}</div>
        </div>
      ))}
    </div>
  );
}

export function ConfigPreview({ schema }: ConfigPreviewProps) {
  const { toast } = useToast();
  const { token, org, app } = useAppContext();

  // Fetch properties data
  const { data: propertiesData, error: propertiesError } = useSWR(
    token && org && app ? ["/organisations/applications/properties/list", token, org, app] : null,
    async () => apiFetch<ListPropertiesResponse>("/organisations/applications/properties/list", {}, { token, org, app })
  );

  const properties: PropertyEntry[] = propertiesData?.properties || [];

  const jsonSchema = generateJsonSchema(schema);

  const copyToClipboard = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: `${label} has been copied to your clipboard.`,
      });
    } catch (err) {
      console.log("Failed to copy to clipboard", err);
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadJson = (content: any, filename: string) => {
    const dataStr = JSON.stringify(content, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = filename;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      {schema.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nothing to preview</h3>
            <p className="text-muted-foreground">
              Create your schema and configuration values to see the preview here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>JSON Schema</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(jsonSchema, null, 2), "JSON Schema")}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copy Schema
                  </Button>
                  <Button size="sm" onClick={() => downloadJson(jsonSchema, "remote-config-schema.json")}>
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                <pre className="text-sm p-4 bg-muted rounded-lg overflow-auto">
                  {JSON.stringify(jsonSchema, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Separate Properties Card - Always show */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-[family-name:var(--font-space-grotesk)]">
                Properties Overview ({properties.length})
              </h3>
              <p className="text-muted-foreground mt-1">
                Application property configurations from active releases and experiments
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(JSON.stringify(properties, null, 2), "All properties")}
                disabled={properties.length === 0}
              >
                <Copy className="h-3 w-3 mr-2" />
                Copy All
              </Button>
              <Button
                size="sm"
                onClick={() => downloadJson(properties, "properties.json")}
                disabled={properties.length === 0}
              >
                <Download className="h-3 w-3 mr-2" />
                Download
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {propertiesError ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <p className="text-red-600">Failed to load properties. Please try again.</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Properties Found</h3>
              <p className="text-muted-foreground">
                No property configurations are currently active for this application.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {properties.map((property, index) => (
                <PropertyCard key={`${property.experiment_id}-${index}`} property={property} index={index} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
