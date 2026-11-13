$version: "2.0"
namespace io.airborne.server

structure TelemetryEvent { @required id: String, @required kind: String }
@length(min: 1, max: 32)
list TelemetryEvents { member: TelemetryEvent }
structure TelemetryBatch {
    @required @length(max: 4096) receipt: String
    @required install_id: String
    @required events: TelemetryEvents
}
structure TelemetryAccepted { @required accepted: Boolean, @required verification: String }
/// Optional unverified device reports. 400 drops invalid/expired receipts; 429 retries later; 503 means disabled/unavailable.
@auth([])
@http(method: "POST", uri: "/api/telemetry/reports", code: 202)
operation IngestTelemetryReports {
    input: TelemetryBatch
    output: TelemetryAccepted
    errors: [BadRequestError, TooManyRequestsError, ServiceUnavailableError, InternalServerError]
}
structure TelemetrySummaryInput {
    @required @httpHeader("x-organisation") organisation: String
    @required @httpHeader("x-application") application: String
}
/// Advisory only; reports never change releases. Native versions and rows are bounded.
structure TelemetrySummary {
    window_days: Integer
    verification: String
    automatic_action: String
    adoption_definition: String
    releases: Document
    release_totals: Document
    blocked_package_versions: Document
}
@requiresauth
@readonly
@http(method: "GET", uri: "/api/control-center/telemetry", code: 200)
operation GetTelemetrySummary {
    input: TelemetrySummaryInput
    output: TelemetrySummary
    errors: [BadRequestError, Unauthorized, ForbiddenError, InternalServerError]
}
