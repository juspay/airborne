import { AirborneServiceException as __BaseException } from "../models/AirborneServiceException";
import { ApprovalRequiredError, BadRequestError, ConflictError, ForbiddenError, InternalServerError, NotFoundError, ReleaseSupersededError, RollbackPartialFailureError, RollbackReplacementChangedError, RollbackUnprocessableError, ServiceUnavailableError, TooManyRequestsError, Unauthorized, UnresolvedOperationError, } from "../models/models_0";
import { loadRestJsonErrorCode, parseJsonBody as parseBody, parseJsonErrorBody as parseErrorBody, } from "@aws-sdk/core";
import { requestBuilder as rb } from "@smithy/core";
import { decorateServiceException as __decorateServiceException, expectBoolean as __expectBoolean, expectInt32 as __expectInt32, expectLong as __expectLong, expectNonNull as __expectNonNull, expectNumber as __expectNumber, expectObject as __expectObject, expectString as __expectString, parseEpochTimestamp as __parseEpochTimestamp, parseRfc3339DateTimeWithOffset as __parseRfc3339DateTimeWithOffset, _json, collectBody, isSerializableHeaderValue, map, take, withBaseException, } from "@smithy/smithy-client";
export const se_AcknowledgeEmergencyRollbackCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/acknowledge-emergency");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ApproveControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}/approve");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CancelControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}/cancel");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ConcludeReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/conclude");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'change_reason': [],
        'chosen_variant': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateApplicationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/organisations/applications/create");
    let body;
    body = JSON.stringify(take(input, {
        'application': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateCohortRangeCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}/cohort/range");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    body = JSON.stringify(take(input, {
        'lower': [],
        'name': [],
        'priority': [],
        'upper': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests");
    let body;
    body = JSON.stringify(take(input, {
        'action': [],
        'payload': _ => se_DeploymentRequestInputPayload(_, context),
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateControlCenterGroupCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups");
    let body;
    body = JSON.stringify(take(input, {
        'members': _ => _json(_),
        'name': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateDimensionCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/create");
    let body;
    body = JSON.stringify(take(input, {
        'depends_on': [],
        'description': [],
        'dimension': [],
        'dimension_type': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateFileCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file");
    let body;
    body = JSON.stringify(take(input, {
        'file_path': [],
        'metadata': _ => se_Document(_, context),
        'tag': [],
        'url': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateOrganisationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/create");
    let body;
    body = JSON.stringify(take(input, {
        'name': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreatePackageCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages");
    let body;
    body = JSON.stringify(take(input, {
        'files': _ => _json(_),
        'index': [],
        'tag': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_CreateReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases");
    let body;
    body = JSON.stringify(take(input, {
        'config': _ => se_CreateReleaseRequestConfig(_, context),
        'dimensions': _ => se_DimensionsMap(_, context),
        'package': _ => se_CreateReleaseRequestPackage(_, context),
        'package_id': [],
        'resources': _ => _json(_),
        'rollback_sensitive': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_DeleteControlCenterGroupCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups/{id}");
    b.p('id', () => input.id, '{id}', false);
    let body;
    b.m("DELETE")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_DeleteDimensionCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    b.m("DELETE")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_DiscardReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/discard");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'change_reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetControlCenterApprovalPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/approval-policy");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}");
    b.p('id', () => input.id, '{id}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetControlCenterOverviewCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/api/control-center/overview");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetControlCenterReleaseEventsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/releases/{release_id}/events");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetControlCenterRollbackPreviewCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/releases/{release_id}/rollback-preview");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{releaseId}");
    b.p('releaseId', () => input.releaseId, '{releaseId}', false);
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetServingPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/serving-policy");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetTelemetrySummaryCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/telemetry");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_GetUserCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/api/users");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_IngestTelemetryReportsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/telemetry/reports");
    let body;
    body = JSON.stringify(take(input, {
        'events': _ => _json(_),
        'install_id': [],
        'receipt': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ListControlCenterDeploymentRequestsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests");
    const query = map({
        [_s]: [, input[_s]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListControlCenterGroupsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ListControlCenterOperationsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/operations");
    const query = map({
        [_s]: [, input[_s]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListDimensionsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListFileGroupsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/groups");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
        [_se]: [, input[_se]],
        [_t]: [, input[_t]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListFilesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_pp]: [() => input.per_page !== void 0, () => (input[_pp].toString())],
        [_se]: [, input[_se]],
        [_t]: [, input[_t]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListOrganisationsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/api/organisations");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ListPackagesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
        [_se]: [, input[_se]],
        [_al]: [() => input.all !== void 0, () => (input[_al].toString())],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ListReleasesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        [_xd]: input[_d],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/list");
    const query = map({
        [_p]: [() => input.page !== void 0, () => (input[_p].toString())],
        [_c]: [() => input.count !== void 0, () => (input[_c].toString())],
        [_al]: [() => input.all !== void 0, () => (input[_al].toString())],
        [_s]: [, input[_s]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_PostLoginCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/token/issue");
    let body;
    body = JSON.stringify(take(input, {
        'client_id': [],
        'client_secret': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_PreviewServingPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/serving-policy/preview");
    let body;
    body = JSON.stringify(take(input, {
        'context': _ => _json(_),
        'toss': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_PutServingPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/serving-policy");
    let body;
    body = JSON.stringify(take(input, {
        'strict': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_RampReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/ramp");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'change_reason': [],
        'traffic_percentage': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_RejectControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}/reject");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_RequestOrganisationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/request");
    let body;
    body = JSON.stringify(take(input, {
        'app_store_link': [],
        'email': [],
        'name': [],
        'organisation_name': [],
        'phone': [],
        'play_store_link': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ResolveControlCenterOperationCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/operations/{id}/resolve");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'finding': [],
        'reason': [],
        'request_terminated': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_RollbackReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/rollback");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'confirm_sensitive_risk': [],
        'emergency': [],
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_ServeReleaseCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/release/{organisation}/{application}");
    b.p('organisation', () => input.organisation, '{organisation}', false);
    b.p('application', () => input.application, '{application}', false);
    const query = map({
        [_tp]: [, input[_tp]],
        [_nv]: [, input[_nv]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_ServeReleaseV2Command = async (input, context) => {
    const b = rb(input, context);
    const headers = {};
    b.bp("/release/v2/{organisation}/{application}");
    b.p('organisation', () => input.organisation, '{organisation}', false);
    b.p('application', () => input.application, '{application}', false);
    const query = map({
        [_tp]: [, input[_tp]],
        [_nv]: [, input[_nv]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const se_UpdateControlCenterApprovalPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/approval-policy");
    let body;
    body = JSON.stringify(take(input, {
        'checkers': _ => _json(_),
        'emergency_rollback': [],
        'enabled': [],
        'makers': _ => _json(_),
        'request_ttl_hours': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_UpdateControlCenterGroupCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups/{id}");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify(take(input, {
        'members': _ => _json(_),
        'name': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_UpdateDimensionCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    body = JSON.stringify(take(input, {
        'change_reason': [],
        'position': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_UpdateFileCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/{file_key}");
    b.p('file_key', () => input.file_key, '{file_key}', false);
    let body;
    body = JSON.stringify(take(input, {
        'tag': [],
    }));
    b.m("PATCH")
        .h(headers)
        .b(body);
    return b.build();
};
export const se_UploadFileCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = map({}, isSerializableHeaderValue, {
        'content-type': 'application/octet-stream',
        [_xc]: input[_ch],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/upload");
    const query = map({
        [_fp]: [, __expectNonNull(input[_fp], `file_path`)],
        [_ta]: [, input[_ta]],
    });
    let body;
    if (input.file !== undefined) {
        body = input.file;
    }
    b.m("POST")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
export const de_AcknowledgeEmergencyRollbackCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'success': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ApproveControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': __expectString,
        'application': __expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'org': __expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': __expectString,
        'reason': __expectString,
        'requester': __expectString,
        'result': _ => de_Document(_, context),
        'status': __expectString,
        'updated_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CancelControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': __expectString,
        'application': __expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'org': __expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': __expectString,
        'reason': __expectString,
        'requester': __expectString,
        'result': _ => de_Document(_, context),
        'status': __expectString,
        'updated_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ConcludeReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'chosen_variant': __expectString,
        'experiment_id': __expectString,
        'message': __expectString,
        'success': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateApplicationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'access': _json,
        'application': __expectString,
        'organisation': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateCohortRangeCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'lower': __expectString,
        'name': __expectString,
        'priority': __expectInt32,
        'upper': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': __expectString,
        'application': __expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'org': __expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': __expectString,
        'reason': __expectString,
        'requester': __expectString,
        'result': _ => de_Document(_, context),
        'status': __expectString,
        'updated_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateControlCenterGroupCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'id': __expectString,
        'members': _json,
        'name': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'change_reason': __expectString,
        'description': _ => de_Document(_, context),
        'dimension': __expectString,
        'position': __expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'checksum': __expectString,
        'created_at': __expectString,
        'file_path': __expectString,
        'id': __expectString,
        'metadata': _ => de_Document(_, context),
        'size': __expectInt32,
        'status': __expectString,
        'tag': __expectString,
        'url': __expectString,
        'version': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'access': _json,
        'applications': _json,
        'name': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreatePackageCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'files': _json,
        'index': __expectString,
        'tag': __expectString,
        'version': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_CreateReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': __expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': _json,
        'id': __expectString,
        'package': _ => de_ServePackage(_, context),
        'warnings': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_DeleteControlCenterGroupCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'success': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_DeleteDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_DiscardReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'experiment_id': __expectString,
        'message': __expectString,
        'success': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetControlCenterApprovalPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'checkers': _json,
        'emergency_rollback': __expectBoolean,
        'enabled': __expectBoolean,
        'makers': _json,
        'request_ttl_hours': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': __expectString,
        'application': __expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'org': __expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': __expectString,
        'reason': __expectString,
        'requester': __expectString,
        'result': _ => de_Document(_, context),
        'status': __expectString,
        'updated_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetControlCenterOverviewCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'generated_at': _ => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
        'organisations': _ => de_ControlCenterOrganisationOverviewList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetControlCenterReleaseEventsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'events': _ => de_ControlCenterReleaseEventList(_, context),
        'outcome': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetControlCenterRollbackPreviewCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': _ => de_Document(_, context),
        'blocked': _ => de_Document(_, context),
        'blocked_package_versions': _json,
        'current_package_version': _ => de_Document(_, context),
        'reconciled_keys': _ => de_Document(_, context),
        'resulting_package_version': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': __expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': _json,
        'id': __expectString,
        'package': _ => de_ServePackage(_, context),
        'resources': _json,
        'warnings': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetServingPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'deployment_override': __expectBoolean,
        'effective_strict': __expectBoolean,
        'strict': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetTelemetrySummaryCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'adoption_definition': __expectString,
        'automatic_action': __expectString,
        'blocked_package_versions': _ => de_Document(_, context),
        'release_totals': _ => de_Document(_, context),
        'releases': _ => de_Document(_, context),
        'verification': __expectString,
        'window_days': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetUserCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'organisations': _json,
        'user_id': __expectString,
        'user_token': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_IngestTelemetryReportsCommand = async (output, context) => {
    if (output.statusCode !== 202 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'accepted': __expectBoolean,
        'verification': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListControlCenterDeploymentRequestsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'requests': _ => de_ControlCenterDeploymentRequestList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListControlCenterGroupsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'groups': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListControlCenterOperationsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'operations': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListDimensionsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'data': _ => de_DimensionList(_, context),
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListFileGroupsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'count': __expectInt32,
        'groups': _json,
        'page': __expectInt32,
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListFilesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'application': __expectString,
        'files': _ => de_FileResponseList(_, context),
        'organisation': __expectString,
        'page': __expectInt32,
        'per_page': __expectInt32,
        'total': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListOrganisationsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'organisations': _json,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListPackagesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'data': _json,
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListReleasesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'data': _ => de_GetReleaseResponseList(_, context),
        'total_items': __expectInt32,
        'total_pages': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_PostLoginCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'access_token': __expectString,
        'expires_in': __expectLong,
        'refresh_expires_in': __expectLong,
        'refresh_token': __expectString,
        'token_type': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_PreviewServingPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'config_version': __expectString,
        'context': _json,
        'package_version': _ => de_Document(_, context),
        'scope': __expectString,
        'serving_policy': _json,
        'strict_status': __expectInt32,
        'targeted': __expectBoolean,
        'toss': __expectString,
        'would_stop_serving': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_PutServingPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'deployment_override': __expectBoolean,
        'effective_strict': __expectBoolean,
        'strict': __expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_RampReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'experiment_id': __expectString,
        'message': __expectString,
        'success': __expectBoolean,
        'traffic_percentage': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_RejectControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': __expectString,
        'application': __expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'org': __expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': __expectString,
        'reason': __expectString,
        'requester': __expectString,
        'result': _ => de_Document(_, context),
        'status': __expectString,
        'updated_at': _ => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_RequestOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'message': __expectString,
        'organisation_name': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ResolveControlCenterOperationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'finding': __expectString,
        'operation_id': __expectString,
        'state': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_RollbackReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'action': __expectString,
        'current_live_release_id': _ => de_Document(_, context),
        'later_release_id': _ => de_Document(_, context),
        'new_release_id': _ => de_Document(_, context),
        'reconciled_keys': _json,
        'release_id': __expectString,
        'rolled_back_to_package_version': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ServeReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'blocked_package_versions': _json,
        'config': _ => de_GetReleaseConfig(_, context),
        'package': _json,
        'resources': _ => de_Document(_, context),
        'telemetry': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ServeReleaseV2Command = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'blocked_package_versions': _json,
        'config': _ => de_GetReleaseConfig(_, context),
        'package': _json,
        'resources': _ => de_Document(_, context),
        'telemetry': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_UpdateControlCenterApprovalPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'checkers': _json,
        'emergency_rollback': __expectBoolean,
        'enabled': __expectBoolean,
        'makers': _json,
        'request_ttl_hours': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_UpdateControlCenterGroupCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'id': __expectString,
        'members': _json,
        'name': __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_UpdateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'change_reason': __expectString,
        'description': _ => de_Document(_, context),
        'dimension': __expectString,
        'mandatory': __expectBoolean,
        'position': __expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_UpdateFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'checksum': __expectString,
        'created_at': __expectString,
        'file_path': __expectString,
        'id': __expectString,
        'metadata': _ => de_Document(_, context),
        'size': __expectInt32,
        'status': __expectString,
        'tag': __expectString,
        'url': __expectString,
        'version': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_UploadFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull((__expectObject(await parseBody(output.body, context))), "body");
    const doc = take(data, {
        'checksum': __expectString,
        'created_at': __expectString,
        'file_path': __expectString,
        'id': __expectString,
        'metadata': _ => de_Document(_, context),
        'size': __expectInt32,
        'status': __expectString,
        'tag': __expectString,
        'url': __expectString,
        'version': __expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context)
    };
    const errorCode = loadRestJsonErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "BadRequestError":
        case "io.airborne.server#BadRequestError":
            throw await de_BadRequestErrorRes(parsedOutput, context);
        case "ConflictError":
        case "io.airborne.server#ConflictError":
            throw await de_ConflictErrorRes(parsedOutput, context);
        case "ForbiddenError":
        case "io.airborne.server#ForbiddenError":
            throw await de_ForbiddenErrorRes(parsedOutput, context);
        case "InternalServerError":
        case "io.airborne.server#InternalServerError":
            throw await de_InternalServerErrorRes(parsedOutput, context);
        case "NotFoundError":
        case "io.airborne.server#NotFoundError":
            throw await de_NotFoundErrorRes(parsedOutput, context);
        case "Unauthorized":
        case "io.airborne.server#Unauthorized":
            throw await de_UnauthorizedRes(parsedOutput, context);
        case "RollbackPartialFailureError":
        case "io.airborne.server#RollbackPartialFailureError":
            throw await de_RollbackPartialFailureErrorRes(parsedOutput, context);
        case "RollbackUnprocessableError":
        case "io.airborne.server#RollbackUnprocessableError":
            throw await de_RollbackUnprocessableErrorRes(parsedOutput, context);
        case "UnresolvedOperationError":
        case "io.airborne.server#UnresolvedOperationError":
            throw await de_UnresolvedOperationErrorRes(parsedOutput, context);
        case "ApprovalRequiredError":
        case "io.airborne.server#ApprovalRequiredError":
            throw await de_ApprovalRequiredErrorRes(parsedOutput, context);
        case "ServiceUnavailableError":
        case "io.airborne.server#ServiceUnavailableError":
            throw await de_ServiceUnavailableErrorRes(parsedOutput, context);
        case "TooManyRequestsError":
        case "io.airborne.server#TooManyRequestsError":
            throw await de_TooManyRequestsErrorRes(parsedOutput, context);
        case "ReleaseSupersededError":
        case "io.airborne.server#ReleaseSupersededError":
            throw await de_ReleaseSupersededErrorRes(parsedOutput, context);
        case "RollbackReplacementChangedError":
        case "io.airborne.server#RollbackReplacementChangedError":
            throw await de_RollbackReplacementChangedErrorRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode
            });
    }
};
const throwDefaultError = withBaseException(__BaseException);
const de_ApprovalRequiredErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'application': __expectString,
        'code': __expectString,
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ApprovalRequiredError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_BadRequestErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new BadRequestError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ConflictErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ConflictError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ForbiddenErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ForbiddenError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_InternalServerErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new InternalServerError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_NotFoundErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new NotFoundError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ReleaseSupersededErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'current_live_release_id': _ => de_Document(_, context),
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ReleaseSupersededError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_RollbackPartialFailureErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'replacement_release_id': _ => de_Document(_, context),
        'request_id': __expectString,
        'request_status': __expectString,
        'rollback_operation_id': __expectString,
        'stage': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new RollbackPartialFailureError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_RollbackReplacementChangedErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'operation_id': __expectString,
        'replacement_release_id': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    const exception = new RollbackReplacementChangedError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_RollbackUnprocessableErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'current_live_release_id': _ => de_Document(_, context),
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new RollbackUnprocessableError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ServiceUnavailableErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
        'request_id': __expectString,
        'request_status': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ServiceUnavailableError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_TooManyRequestsErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new TooManyRequestsError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_UnauthorizedRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'code': __expectString,
        'message': __expectString,
    });
    Object.assign(contents, doc);
    const exception = new Unauthorized({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_UnresolvedOperationErrorRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        'before': _ => de_Document(_, context),
        'code': __expectString,
        'expected': _ => de_Document(_, context),
        'message': __expectString,
        'operation_id': __expectString,
        'own_attempt': __expectBoolean,
        'upstream_org': _ => de_Document(_, context),
        'upstream_workspace': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    const exception = new UnresolvedOperationError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const se_CreateReleaseRequestConfig = (input, context) => {
    return take(input, {
        'boot_timeout': [],
        'properties': _ => se_Document(_, context),
        'release_config_timeout': [],
    });
};
const se_CreateReleaseRequestPackage = (input, context) => {
    return take(input, {
        'important': _json,
        'lazy': _json,
        'properties': _ => se_Document(_, context),
    });
};
const se_DeploymentRequestInputPayload = (input, context) => {
    return take(input, {
        'body': _ => se_Document(_, context),
        'release_id': [],
    });
};
const se_DimensionsMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_Document(value, context);
        return acc;
    }, {});
};
const se_Document = (input, context) => {
    return input;
};
const de_ConfigProperties = (output, context) => {
    return take(output, {
        'tenant_info': (_) => de_Document(_, context),
    });
};
const de_ControlCenterActiveRelease = (output, context) => {
    return take(output, {
        'created_at': (_) => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
        'created_by': __expectString,
        'dimensions': (_) => de_Document(_, context),
        'experimental_variant': __expectString,
        'package_version': __expectLong,
        'release_id': __expectString,
        'status': __expectString,
        'traffic_percentage': __expectInt32,
    });
};
const de_ControlCenterActiveReleaseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterActiveRelease(entry, context);
    });
    return retVal;
};
const de_ControlCenterAppStatus = (output, context) => {
    return take(output, {
        'active': (_) => de_ControlCenterActiveReleaseList(_, context),
        'application': __expectString,
        'approval_required': __expectBoolean,
        'auxiliary_error': __expectString,
        'cache_invalidation': (_) => de_Document(_, context),
        'emergency_needs_review': (_) => de_EmergencyReviewList(_, context),
        'error': (_) => de_Document(_, context),
        'last_activity_at': (_) => de_Document(_, context),
        'live': (_) => de_ControlCenterLiveReleaseList(_, context),
        'pending_requests': __expectInt32,
        'platform': (_) => de_Document(_, context),
        'release_protections': (_) => de_ReleaseProtectionList(_, context),
        'serving_policy': _json,
        'telemetry': (_) => de_Document(_, context),
        'unresolved_operations': _json,
    });
};
const de_ControlCenterAppStatusList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterAppStatus(entry, context);
    });
    return retVal;
};
const de_ControlCenterDeploymentRequest = (output, context) => {
    return take(output, {
        'action': __expectString,
        'application': __expectString,
        'base_state': (_) => de_Document(_, context),
        'created_at': (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'decided_by': (_) => de_Document(_, context),
        'decision_reason': (_) => de_Document(_, context),
        'expires_at': (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'org': __expectString,
        'payload': (_) => de_DeploymentRequestPayload(_, context),
        'payload_hash': __expectString,
        'reason': __expectString,
        'requester': __expectString,
        'result': (_) => de_Document(_, context),
        'status': __expectString,
        'updated_at': (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
};
const de_ControlCenterDeploymentRequestList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterDeploymentRequest(entry, context);
    });
    return retVal;
};
const de_ControlCenterLiveRelease = (output, context) => {
    return take(output, {
        'concluded_at': (_) => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
        'config_version': __expectString,
        'dimensions': (_) => de_Document(_, context),
        'package_version': __expectLong,
        'release_id': __expectString,
    });
};
const de_ControlCenterLiveReleaseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterLiveRelease(entry, context);
    });
    return retVal;
};
const de_ControlCenterOrganisationOverview = (output, context) => {
    return take(output, {
        'groups': (_) => de_ControlCenterOverviewGroupList(_, context),
        'name': __expectString,
        'ungrouped': (_) => de_ControlCenterAppStatusList(_, context),
    });
};
const de_ControlCenterOrganisationOverviewList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterOrganisationOverview(entry, context);
    });
    return retVal;
};
const de_ControlCenterOverviewGroup = (output, context) => {
    return take(output, {
        'id': __expectString,
        'members': (_) => de_ControlCenterAppStatusList(_, context),
        'name': __expectString,
    });
};
const de_ControlCenterOverviewGroupList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterOverviewGroup(entry, context);
    });
    return retVal;
};
const de_ControlCenterReleaseEvent = (output, context) => {
    return take(output, {
        'action': __expectString,
        'actor': __expectString,
        'created_at': (_) => __expectNonNull(__parseRfc3339DateTimeWithOffset(_)),
        'payload': (_) => de_Document(_, context),
        'synthetic': __expectBoolean,
    });
};
const de_ControlCenterReleaseEventList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterReleaseEvent(entry, context);
    });
    return retVal;
};
const de_CreateFileResponse = (output, context) => {
    return take(output, {
        'checksum': __expectString,
        'created_at': __expectString,
        'file_path': __expectString,
        'id': __expectString,
        'metadata': (_) => de_Document(_, context),
        'size': __expectInt32,
        'status': __expectString,
        'tag': __expectString,
        'url': __expectString,
        'version': __expectInt32,
    });
};
const de_DeploymentRequestPayload = (output, context) => {
    return take(output, {
        'body': (_) => de_Document(_, context),
        'release_id': __expectString,
        'snapshot': (_) => de_Document(_, context),
    });
};
const de_DimensionList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_DimensionResponse(entry, context);
    });
    return retVal;
};
const de_DimensionResponse = (output, context) => {
    return take(output, {
        'change_reason': __expectString,
        'description': (_) => de_Document(_, context),
        'dimension': __expectString,
        'mandatory': __expectBoolean,
        'position': __expectInt32,
        'schema': (_) => de_Document(_, context),
    });
};
const de_DimensionsMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_Document(value, context);
        return acc;
    }, {});
};
const de_EmergencyReview = (output, context) => {
    return take(output, {
        'acknowledged_by': (_) => de_Document(_, context),
        'actor': __expectString,
        'confirm_sensitive_risk': __expectBoolean,
        'created_at': (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        'id': __expectString,
        'new_release_id': (_) => de_Document(_, context),
        'plan': (_) => de_Document(_, context),
        'reason': __expectString,
        'release_id': __expectString,
        'rollback_finished': __expectBoolean,
        'rollback_result': (_) => de_Document(_, context),
        'rolled_back_to_package_version': (_) => de_Document(_, context),
    });
};
const de_EmergencyReviewList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_EmergencyReview(entry, context);
    });
    return retVal;
};
const de_FileResponseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_CreateFileResponse(entry, context);
    });
    return retVal;
};
const de_GetReleaseConfig = (output, context) => {
    return take(output, {
        'boot_timeout': __expectInt32,
        'properties': (_) => de_ConfigProperties(_, context),
        'release_config_timeout': __expectInt32,
        'version': __expectString,
    });
};
const de_GetReleaseResponse = (output, context) => {
    return take(output, {
        'config': (_) => de_GetReleaseConfig(_, context),
        'created_at': __expectString,
        'dimensions': (_) => de_DimensionsMap(_, context),
        'experiment': _json,
        'id': __expectString,
        'package': (_) => de_ServePackage(_, context),
        'resources': _json,
        'warnings': _json,
    });
};
const de_GetReleaseResponseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_GetReleaseResponse(entry, context);
    });
    return retVal;
};
const de_ReleaseProtection = (output, context) => {
    return take(output, {
        'release_id': __expectString,
        'rollback_sensitive': (_) => de_Document(_, context),
    });
};
const de_ReleaseProtectionList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ReleaseProtection(entry, context);
    });
    return retVal;
};
const de_ServePackage = (output, context) => {
    return take(output, {
        'important': _json,
        'index': _json,
        'lazy': _json,
        'name': __expectString,
        'properties': (_) => de_Document(_, context),
        'version': __expectString,
    });
};
const de_Document = (output, context) => {
    return output;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => collectBody(streamBody, context).then(body => context.utf8Encoder(body));
const _a = "application";
const _al = "all";
const _c = "count";
const _ch = "checksum";
const _d = "dimension";
const _fp = "file_path";
const _nv = "native_version";
const _o = "organisation";
const _p = "page";
const _pp = "per_page";
const _s = "status";
const _se = "search";
const _t = "tags";
const _ta = "tag";
const _tp = "telemetry_platform";
const _xa = "x-application";
const _xc = "x-checksum";
const _xd = "x-dimension";
const _xo = "x-organisation";
