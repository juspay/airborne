import axios from "./axios";

export interface RampReleaseRequest {
  traffic_percentage: number;
  change_reason?: string;
}

export interface ConcludeReleaseRequest {
  chosen_variant: string;
  change_reason?: string;
}

export interface RampReleaseResponse {
  success: boolean;
  message: string;
  experiment_id: string;
  traffic_percentage: number;
}

export interface ConcludeReleaseResponse {
  success: boolean;
  message: string;
  experiment_id: string;
  chosen_variant: string;
}

export class ReleaseAPI {
  /**
   * Ramp up traffic for a release experiment
   */
  static async rampRelease(
    releaseId: string,
    request: RampReleaseRequest,
    organisation: string,
    application: string
  ): Promise<RampReleaseResponse> {
    const { data } = await axios.patch<RampReleaseResponse>(
      `/organisations/applications/release/${releaseId}/ramp`,
      request,
      {
        headers: {
          "x-organisation": organisation,
          "x-application": application,
        },
      }
    );
    return data;
  }

  /**
   * Conclude a release experiment
   */
  static async concludeRelease(
    releaseId: string,
    request: ConcludeReleaseRequest,
    organisation: string,
    application: string
  ): Promise<ConcludeReleaseResponse> {
    const { data } = await axios.patch<ConcludeReleaseResponse>(
      `/organisations/applications/release/${releaseId}/conclude`,
      request,
      {
        headers: {
          "x-organisation": organisation,
          "x-application": application,
        },
      }
    );
    return data;
  }

  /**
   * Fetch experiment details to get current traffic percentage and variants
   */
  static async getExperimentDetails(
    experimentId: string,
    organisation: string,
    application: string
  ) {
    try {
      const { data } = await axios.get(
        `/organisations/applications/release/experiment/${experimentId}`,
        {
          headers: {
            "x-organisation": organisation,
            "x-application": application,
          },
        }
      );
      return data;
    } catch (error) {
      console.error("Failed to fetch experiment details:", error);
      // Return fallback data
      return {
        traffic_percentage: 0,
        variants: [
          { id: "control", name: "Control (Original)" },
          { id: "experimental_variant", name: "Experimental (New Version)" }
        ]
      };
    }
  }

  /**
   * Fetch release history for an application
   */
  static async getReleaseHistory(organisation: string, application: string) {
    const { data } = await axios.get(`/organisations/applications/release/history`, {
      headers: {
        "x-organisation": organisation,
        "x-application": application,
      },
    });
    return data;
  }
}

export default ReleaseAPI;