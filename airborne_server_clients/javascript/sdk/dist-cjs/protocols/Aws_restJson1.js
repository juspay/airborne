"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.se_UploadFileCommand = exports.se_UpdateFileCommand = exports.se_UpdateDimensionCommand = exports.se_UpdateControlCenterGroupCommand = exports.se_UpdateControlCenterApprovalPolicyCommand = exports.se_ServeReleaseV2Command = exports.se_ServeReleaseCommand = exports.se_RollbackReleaseCommand = exports.se_ResolveControlCenterOperationCommand = exports.se_RequestOrganisationCommand = exports.se_RejectControlCenterDeploymentRequestCommand = exports.se_RampReleaseCommand = exports.se_PutServingPolicyCommand = exports.se_PreviewServingPolicyCommand = exports.se_PostLoginCommand = exports.se_ListReleasesCommand = exports.se_ListPackagesCommand = exports.se_ListOrganisationsCommand = exports.se_ListFilesCommand = exports.se_ListFileGroupsCommand = exports.se_ListDimensionsCommand = exports.se_ListControlCenterOperationsCommand = exports.se_ListControlCenterGroupsCommand = exports.se_ListControlCenterDeploymentRequestsCommand = exports.se_IngestTelemetryReportsCommand = exports.se_GetUserCommand = exports.se_GetTelemetrySummaryCommand = exports.se_GetServingPolicyCommand = exports.se_GetReleaseCommand = exports.se_GetControlCenterRollbackPreviewCommand = exports.se_GetControlCenterReleaseEventsCommand = exports.se_GetControlCenterOverviewCommand = exports.se_GetControlCenterDeploymentRequestCommand = exports.se_GetControlCenterApprovalPolicyCommand = exports.se_DiscardReleaseCommand = exports.se_DeleteDimensionCommand = exports.se_DeleteControlCenterGroupCommand = exports.se_CreateReleaseCommand = exports.se_CreatePackageCommand = exports.se_CreateOrganisationCommand = exports.se_CreateFileCommand = exports.se_CreateDimensionCommand = exports.se_CreateControlCenterGroupCommand = exports.se_CreateControlCenterDeploymentRequestCommand = exports.se_CreateCohortRangeCommand = exports.se_CreateApplicationCommand = exports.se_ConcludeReleaseCommand = exports.se_CancelControlCenterDeploymentRequestCommand = exports.se_ApproveControlCenterDeploymentRequestCommand = exports.se_AcknowledgeEmergencyRollbackCommand = void 0;
exports.de_UploadFileCommand = exports.de_UpdateFileCommand = exports.de_UpdateDimensionCommand = exports.de_UpdateControlCenterGroupCommand = exports.de_UpdateControlCenterApprovalPolicyCommand = exports.de_ServeReleaseV2Command = exports.de_ServeReleaseCommand = exports.de_RollbackReleaseCommand = exports.de_ResolveControlCenterOperationCommand = exports.de_RequestOrganisationCommand = exports.de_RejectControlCenterDeploymentRequestCommand = exports.de_RampReleaseCommand = exports.de_PutServingPolicyCommand = exports.de_PreviewServingPolicyCommand = exports.de_PostLoginCommand = exports.de_ListReleasesCommand = exports.de_ListPackagesCommand = exports.de_ListOrganisationsCommand = exports.de_ListFilesCommand = exports.de_ListFileGroupsCommand = exports.de_ListDimensionsCommand = exports.de_ListControlCenterOperationsCommand = exports.de_ListControlCenterGroupsCommand = exports.de_ListControlCenterDeploymentRequestsCommand = exports.de_IngestTelemetryReportsCommand = exports.de_GetUserCommand = exports.de_GetTelemetrySummaryCommand = exports.de_GetServingPolicyCommand = exports.de_GetReleaseCommand = exports.de_GetControlCenterRollbackPreviewCommand = exports.de_GetControlCenterReleaseEventsCommand = exports.de_GetControlCenterOverviewCommand = exports.de_GetControlCenterDeploymentRequestCommand = exports.de_GetControlCenterApprovalPolicyCommand = exports.de_DiscardReleaseCommand = exports.de_DeleteDimensionCommand = exports.de_DeleteControlCenterGroupCommand = exports.de_CreateReleaseCommand = exports.de_CreatePackageCommand = exports.de_CreateOrganisationCommand = exports.de_CreateFileCommand = exports.de_CreateDimensionCommand = exports.de_CreateControlCenterGroupCommand = exports.de_CreateControlCenterDeploymentRequestCommand = exports.de_CreateCohortRangeCommand = exports.de_CreateApplicationCommand = exports.de_ConcludeReleaseCommand = exports.de_CancelControlCenterDeploymentRequestCommand = exports.de_ApproveControlCenterDeploymentRequestCommand = exports.de_AcknowledgeEmergencyRollbackCommand = void 0;
const AirborneServiceException_1 = require("../models/AirborneServiceException");
const models_0_1 = require("../models/models_0");
const core_1 = require("@aws-sdk/core");
const core_2 = require("@smithy/core");
const smithy_client_1 = require("@smithy/smithy-client");
const se_AcknowledgeEmergencyRollbackCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/acknowledge-emergency");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_AcknowledgeEmergencyRollbackCommand = se_AcknowledgeEmergencyRollbackCommand;
const se_ApproveControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}/approve");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_ApproveControlCenterDeploymentRequestCommand = se_ApproveControlCenterDeploymentRequestCommand;
const se_CancelControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}/cancel");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CancelControlCenterDeploymentRequestCommand = se_CancelControlCenterDeploymentRequestCommand;
const se_ConcludeReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/conclude");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'change_reason': [],
        'chosen_variant': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_ConcludeReleaseCommand = se_ConcludeReleaseCommand;
const se_CreateApplicationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/organisations/applications/create");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'application': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateApplicationCommand = se_CreateApplicationCommand;
const se_CreateCohortRangeCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}/cohort/range");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_CreateCohortRangeCommand = se_CreateCohortRangeCommand;
const se_CreateControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'action': [],
        'payload': _ => se_DeploymentRequestInputPayload(_, context),
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateControlCenterDeploymentRequestCommand = se_CreateControlCenterDeploymentRequestCommand;
const se_CreateControlCenterGroupCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'members': _ => (0, smithy_client_1._json)(_),
        'name': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateControlCenterGroupCommand = se_CreateControlCenterGroupCommand;
const se_CreateDimensionCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/create");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_CreateDimensionCommand = se_CreateDimensionCommand;
const se_CreateFileCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_CreateFileCommand = se_CreateFileCommand;
const se_CreateOrganisationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/create");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'name': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateOrganisationCommand = se_CreateOrganisationCommand;
const se_CreatePackageCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'files': _ => (0, smithy_client_1._json)(_),
        'index': [],
        'tag': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreatePackageCommand = se_CreatePackageCommand;
const se_CreateReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'config': _ => se_CreateReleaseRequestConfig(_, context),
        'dimensions': _ => se_DimensionsMap(_, context),
        'package': _ => se_CreateReleaseRequestPackage(_, context),
        'package_id': [],
        'resources': _ => (0, smithy_client_1._json)(_),
        'rollback_sensitive': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_CreateReleaseCommand = se_CreateReleaseCommand;
const se_DeleteControlCenterGroupCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_DeleteControlCenterGroupCommand = se_DeleteControlCenterGroupCommand;
const se_DeleteDimensionCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_DeleteDimensionCommand = se_DeleteDimensionCommand;
const se_DiscardReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/discard");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'change_reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_DiscardReleaseCommand = se_DiscardReleaseCommand;
const se_GetControlCenterApprovalPolicyCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetControlCenterApprovalPolicyCommand = se_GetControlCenterApprovalPolicyCommand;
const se_GetControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetControlCenterDeploymentRequestCommand = se_GetControlCenterDeploymentRequestCommand;
const se_GetControlCenterOverviewCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/api/control-center/overview");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_GetControlCenterOverviewCommand = se_GetControlCenterOverviewCommand;
const se_GetControlCenterReleaseEventsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetControlCenterReleaseEventsCommand = se_GetControlCenterReleaseEventsCommand;
const se_GetControlCenterRollbackPreviewCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetControlCenterRollbackPreviewCommand = se_GetControlCenterRollbackPreviewCommand;
const se_GetReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetReleaseCommand = se_GetReleaseCommand;
const se_GetServingPolicyCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetServingPolicyCommand = se_GetServingPolicyCommand;
const se_GetTelemetrySummaryCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
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
exports.se_GetTelemetrySummaryCommand = se_GetTelemetrySummaryCommand;
const se_GetUserCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/api/users");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_GetUserCommand = se_GetUserCommand;
const se_IngestTelemetryReportsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/telemetry/reports");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'events': _ => (0, smithy_client_1._json)(_),
        'install_id': [],
        'receipt': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_IngestTelemetryReportsCommand = se_IngestTelemetryReportsCommand;
const se_ListControlCenterDeploymentRequestsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests");
    const query = (0, smithy_client_1.map)({
        [_s]: [, input[_s]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
exports.se_ListControlCenterDeploymentRequestsCommand = se_ListControlCenterDeploymentRequestsCommand;
const se_ListControlCenterGroupsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_ListControlCenterGroupsCommand = se_ListControlCenterGroupsCommand;
const se_ListControlCenterOperationsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/operations");
    const query = (0, smithy_client_1.map)({
        [_s]: [, input[_s]],
    });
    let body;
    b.m("GET")
        .h(headers)
        .q(query)
        .b(body);
    return b.build();
};
exports.se_ListControlCenterOperationsCommand = se_ListControlCenterOperationsCommand;
const se_ListDimensionsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListDimensionsCommand = se_ListDimensionsCommand;
const se_ListFileGroupsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/groups");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListFileGroupsCommand = se_ListFileGroupsCommand;
const se_ListFilesCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListFilesCommand = se_ListFilesCommand;
const se_ListOrganisationsCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/api/organisations");
    let body;
    b.m("GET")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_ListOrganisationsCommand = se_ListOrganisationsCommand;
const se_ListPackagesCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/packages/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListPackagesCommand = se_ListPackagesCommand;
const se_ListReleasesCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        [_xd]: input[_d],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/list");
    const query = (0, smithy_client_1.map)({
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
exports.se_ListReleasesCommand = se_ListReleasesCommand;
const se_PostLoginCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/token/issue");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'client_id': [],
        'client_secret': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_PostLoginCommand = se_PostLoginCommand;
const se_PreviewServingPolicyCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/serving-policy/preview");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'context': _ => (0, smithy_client_1._json)(_),
        'toss': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_PreviewServingPolicyCommand = se_PreviewServingPolicyCommand;
const se_PutServingPolicyCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/serving-policy");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'strict': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_PutServingPolicyCommand = se_PutServingPolicyCommand;
const se_RampReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/ramp");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'change_reason': [],
        'traffic_percentage': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_RampReleaseCommand = se_RampReleaseCommand;
const se_RejectControlCenterDeploymentRequestCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/deployment-requests/{id}/reject");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_RejectControlCenterDeploymentRequestCommand = se_RejectControlCenterDeploymentRequestCommand;
const se_RequestOrganisationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {
        'content-type': 'application/json',
    };
    b.bp("/api/organisations/request");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
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
exports.se_RequestOrganisationCommand = se_RequestOrganisationCommand;
const se_ResolveControlCenterOperationCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/operations/{id}/resolve");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'finding': [],
        'reason': [],
        'request_terminated': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_ResolveControlCenterOperationCommand = se_ResolveControlCenterOperationCommand;
const se_RollbackReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/releases/{release_id}/rollback");
    b.p('release_id', () => input.release_id, '{release_id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'confirm_sensitive_risk': [],
        'emergency': [],
        'reason': [],
    }));
    b.m("POST")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_RollbackReleaseCommand = se_RollbackReleaseCommand;
const se_ServeReleaseCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/release/{organisation}/{application}");
    b.p('organisation', () => input.organisation, '{organisation}', false);
    b.p('application', () => input.application, '{application}', false);
    const query = (0, smithy_client_1.map)({
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
exports.se_ServeReleaseCommand = se_ServeReleaseCommand;
const se_ServeReleaseV2Command = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = {};
    b.bp("/release/v2/{organisation}/{application}");
    b.p('organisation', () => input.organisation, '{organisation}', false);
    b.p('application', () => input.application, '{application}', false);
    const query = (0, smithy_client_1.map)({
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
exports.se_ServeReleaseV2Command = se_ServeReleaseV2Command;
const se_UpdateControlCenterApprovalPolicyCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/control-center/approval-policy");
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'checkers': _ => (0, smithy_client_1._json)(_),
        'emergency_rollback': [],
        'enabled': [],
        'makers': _ => (0, smithy_client_1._json)(_),
        'request_ttl_hours': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_UpdateControlCenterApprovalPolicyCommand = se_UpdateControlCenterApprovalPolicyCommand;
const se_UpdateControlCenterGroupCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
    });
    b.bp("/api/control-center/groups/{id}");
    b.p('id', () => input.id, '{id}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'members': _ => (0, smithy_client_1._json)(_),
        'name': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_UpdateControlCenterGroupCommand = se_UpdateControlCenterGroupCommand;
const se_UpdateDimensionCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/organisations/applications/dimension/{dimension}");
    b.p('dimension', () => input.dimension, '{dimension}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'change_reason': [],
        'position': [],
    }));
    b.m("PUT")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_UpdateDimensionCommand = se_UpdateDimensionCommand;
const se_UpdateFileCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/json',
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/{file_key}");
    b.p('file_key', () => input.file_key, '{file_key}', false);
    let body;
    body = JSON.stringify((0, smithy_client_1.take)(input, {
        'tag': [],
    }));
    b.m("PATCH")
        .h(headers)
        .b(body);
    return b.build();
};
exports.se_UpdateFileCommand = se_UpdateFileCommand;
const se_UploadFileCommand = async (input, context) => {
    const b = (0, core_2.requestBuilder)(input, context);
    const headers = (0, smithy_client_1.map)({}, smithy_client_1.isSerializableHeaderValue, {
        'content-type': 'application/octet-stream',
        [_xc]: input[_ch],
        [_xo]: input[_o],
        [_xa]: input[_a],
    });
    b.bp("/api/file/upload");
    const query = (0, smithy_client_1.map)({
        [_fp]: [, (0, smithy_client_1.expectNonNull)(input[_fp], `file_path`)],
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
exports.se_UploadFileCommand = se_UploadFileCommand;
const de_AcknowledgeEmergencyRollbackCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'success': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_AcknowledgeEmergencyRollbackCommand = de_AcknowledgeEmergencyRollbackCommand;
const de_ApproveControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': smithy_client_1.expectString,
        'application': smithy_client_1.expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'org': smithy_client_1.expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': smithy_client_1.expectString,
        'reason': smithy_client_1.expectString,
        'requester': smithy_client_1.expectString,
        'result': _ => de_Document(_, context),
        'status': smithy_client_1.expectString,
        'updated_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ApproveControlCenterDeploymentRequestCommand = de_ApproveControlCenterDeploymentRequestCommand;
const de_CancelControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': smithy_client_1.expectString,
        'application': smithy_client_1.expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'org': smithy_client_1.expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': smithy_client_1.expectString,
        'reason': smithy_client_1.expectString,
        'requester': smithy_client_1.expectString,
        'result': _ => de_Document(_, context),
        'status': smithy_client_1.expectString,
        'updated_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CancelControlCenterDeploymentRequestCommand = de_CancelControlCenterDeploymentRequestCommand;
const de_ConcludeReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'chosen_variant': smithy_client_1.expectString,
        'experiment_id': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'success': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ConcludeReleaseCommand = de_ConcludeReleaseCommand;
const de_CreateApplicationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'access': smithy_client_1._json,
        'application': smithy_client_1.expectString,
        'organisation': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateApplicationCommand = de_CreateApplicationCommand;
const de_CreateCohortRangeCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'lower': smithy_client_1.expectString,
        'name': smithy_client_1.expectString,
        'priority': smithy_client_1.expectInt32,
        'upper': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateCohortRangeCommand = de_CreateCohortRangeCommand;
const de_CreateControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': smithy_client_1.expectString,
        'application': smithy_client_1.expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'org': smithy_client_1.expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': smithy_client_1.expectString,
        'reason': smithy_client_1.expectString,
        'requester': smithy_client_1.expectString,
        'result': _ => de_Document(_, context),
        'status': smithy_client_1.expectString,
        'updated_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateControlCenterDeploymentRequestCommand = de_CreateControlCenterDeploymentRequestCommand;
const de_CreateControlCenterGroupCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'id': smithy_client_1.expectString,
        'members': smithy_client_1._json,
        'name': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateControlCenterGroupCommand = de_CreateControlCenterGroupCommand;
const de_CreateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'change_reason': smithy_client_1.expectString,
        'description': _ => de_Document(_, context),
        'dimension': smithy_client_1.expectString,
        'position': smithy_client_1.expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateDimensionCommand = de_CreateDimensionCommand;
const de_CreateFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': _ => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateFileCommand = de_CreateFileCommand;
const de_CreateOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'access': smithy_client_1._json,
        'applications': smithy_client_1._json,
        'name': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateOrganisationCommand = de_CreateOrganisationCommand;
const de_CreatePackageCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'files': smithy_client_1._json,
        'index': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreatePackageCommand = de_CreatePackageCommand;
const de_CreateReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': smithy_client_1.expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': smithy_client_1._json,
        'id': smithy_client_1.expectString,
        'package': _ => de_ServePackage(_, context),
        'warnings': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_CreateReleaseCommand = de_CreateReleaseCommand;
const de_DeleteControlCenterGroupCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'success': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_DeleteControlCenterGroupCommand = de_DeleteControlCenterGroupCommand;
const de_DeleteDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    await (0, smithy_client_1.collectBody)(output.body, context);
    return contents;
};
exports.de_DeleteDimensionCommand = de_DeleteDimensionCommand;
const de_DiscardReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'experiment_id': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'success': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_DiscardReleaseCommand = de_DiscardReleaseCommand;
const de_GetControlCenterApprovalPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checkers': smithy_client_1._json,
        'emergency_rollback': smithy_client_1.expectBoolean,
        'enabled': smithy_client_1.expectBoolean,
        'makers': smithy_client_1._json,
        'request_ttl_hours': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetControlCenterApprovalPolicyCommand = de_GetControlCenterApprovalPolicyCommand;
const de_GetControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': smithy_client_1.expectString,
        'application': smithy_client_1.expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'org': smithy_client_1.expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': smithy_client_1.expectString,
        'reason': smithy_client_1.expectString,
        'requester': smithy_client_1.expectString,
        'result': _ => de_Document(_, context),
        'status': smithy_client_1.expectString,
        'updated_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetControlCenterDeploymentRequestCommand = de_GetControlCenterDeploymentRequestCommand;
const de_GetControlCenterOverviewCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'generated_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseRfc3339DateTimeWithOffset)(_)),
        'organisations': _ => de_ControlCenterOrganisationOverviewList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetControlCenterOverviewCommand = de_GetControlCenterOverviewCommand;
const de_GetControlCenterReleaseEventsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'events': _ => de_ControlCenterReleaseEventList(_, context),
        'outcome': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetControlCenterReleaseEventsCommand = de_GetControlCenterReleaseEventsCommand;
const de_GetControlCenterRollbackPreviewCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': _ => de_Document(_, context),
        'blocked': _ => de_Document(_, context),
        'blocked_package_versions': smithy_client_1._json,
        'current_package_version': _ => de_Document(_, context),
        'reconciled_keys': _ => de_Document(_, context),
        'resulting_package_version': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetControlCenterRollbackPreviewCommand = de_GetControlCenterRollbackPreviewCommand;
const de_GetReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config': _ => de_GetReleaseConfig(_, context),
        'created_at': smithy_client_1.expectString,
        'dimensions': _ => de_DimensionsMap(_, context),
        'experiment': smithy_client_1._json,
        'id': smithy_client_1.expectString,
        'package': _ => de_ServePackage(_, context),
        'resources': smithy_client_1._json,
        'warnings': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetReleaseCommand = de_GetReleaseCommand;
const de_GetServingPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'deployment_override': smithy_client_1.expectBoolean,
        'effective_strict': smithy_client_1.expectBoolean,
        'strict': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetServingPolicyCommand = de_GetServingPolicyCommand;
const de_GetTelemetrySummaryCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'adoption_definition': smithy_client_1.expectString,
        'automatic_action': smithy_client_1.expectString,
        'blocked_package_versions': _ => de_Document(_, context),
        'release_totals': _ => de_Document(_, context),
        'releases': _ => de_Document(_, context),
        'verification': smithy_client_1.expectString,
        'window_days': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetTelemetrySummaryCommand = de_GetTelemetrySummaryCommand;
const de_GetUserCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'organisations': smithy_client_1._json,
        'user_id': smithy_client_1.expectString,
        'user_token': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_GetUserCommand = de_GetUserCommand;
const de_IngestTelemetryReportsCommand = async (output, context) => {
    if (output.statusCode !== 202 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'accepted': smithy_client_1.expectBoolean,
        'verification': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_IngestTelemetryReportsCommand = de_IngestTelemetryReportsCommand;
const de_ListControlCenterDeploymentRequestsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'requests': _ => de_ControlCenterDeploymentRequestList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListControlCenterDeploymentRequestsCommand = de_ListControlCenterDeploymentRequestsCommand;
const de_ListControlCenterGroupsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'groups': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListControlCenterGroupsCommand = de_ListControlCenterGroupsCommand;
const de_ListControlCenterOperationsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'operations': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListControlCenterOperationsCommand = de_ListControlCenterOperationsCommand;
const de_ListDimensionsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'data': _ => de_DimensionList(_, context),
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListDimensionsCommand = de_ListDimensionsCommand;
const de_ListFileGroupsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'count': smithy_client_1.expectInt32,
        'groups': smithy_client_1._json,
        'page': smithy_client_1.expectInt32,
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListFileGroupsCommand = de_ListFileGroupsCommand;
const de_ListFilesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'application': smithy_client_1.expectString,
        'files': _ => de_FileResponseList(_, context),
        'organisation': smithy_client_1.expectString,
        'page': smithy_client_1.expectInt32,
        'per_page': smithy_client_1.expectInt32,
        'total': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListFilesCommand = de_ListFilesCommand;
const de_ListOrganisationsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'organisations': smithy_client_1._json,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListOrganisationsCommand = de_ListOrganisationsCommand;
const de_ListPackagesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'data': smithy_client_1._json,
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListPackagesCommand = de_ListPackagesCommand;
const de_ListReleasesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'data': _ => de_GetReleaseResponseList(_, context),
        'total_items': smithy_client_1.expectInt32,
        'total_pages': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ListReleasesCommand = de_ListReleasesCommand;
const de_PostLoginCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'access_token': smithy_client_1.expectString,
        'expires_in': smithy_client_1.expectLong,
        'refresh_expires_in': smithy_client_1.expectLong,
        'refresh_token': smithy_client_1.expectString,
        'token_type': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_PostLoginCommand = de_PostLoginCommand;
const de_PreviewServingPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'config_version': smithy_client_1.expectString,
        'context': smithy_client_1._json,
        'package_version': _ => de_Document(_, context),
        'scope': smithy_client_1.expectString,
        'serving_policy': smithy_client_1._json,
        'strict_status': smithy_client_1.expectInt32,
        'targeted': smithy_client_1.expectBoolean,
        'toss': smithy_client_1.expectString,
        'would_stop_serving': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_PreviewServingPolicyCommand = de_PreviewServingPolicyCommand;
const de_PutServingPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'deployment_override': smithy_client_1.expectBoolean,
        'effective_strict': smithy_client_1.expectBoolean,
        'strict': smithy_client_1.expectBoolean,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_PutServingPolicyCommand = de_PutServingPolicyCommand;
const de_RampReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'experiment_id': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'success': smithy_client_1.expectBoolean,
        'traffic_percentage': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_RampReleaseCommand = de_RampReleaseCommand;
const de_RejectControlCenterDeploymentRequestCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': smithy_client_1.expectString,
        'application': smithy_client_1.expectString,
        'base_state': _ => de_Document(_, context),
        'created_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'decided_by': _ => de_Document(_, context),
        'decision_reason': _ => de_Document(_, context),
        'expires_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'org': smithy_client_1.expectString,
        'payload': _ => de_DeploymentRequestPayload(_, context),
        'payload_hash': smithy_client_1.expectString,
        'reason': smithy_client_1.expectString,
        'requester': smithy_client_1.expectString,
        'result': _ => de_Document(_, context),
        'status': smithy_client_1.expectString,
        'updated_at': _ => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_RejectControlCenterDeploymentRequestCommand = de_RejectControlCenterDeploymentRequestCommand;
const de_RequestOrganisationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'message': smithy_client_1.expectString,
        'organisation_name': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_RequestOrganisationCommand = de_RequestOrganisationCommand;
const de_ResolveControlCenterOperationCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'finding': smithy_client_1.expectString,
        'operation_id': smithy_client_1.expectString,
        'state': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ResolveControlCenterOperationCommand = de_ResolveControlCenterOperationCommand;
const de_RollbackReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'action': smithy_client_1.expectString,
        'current_live_release_id': _ => de_Document(_, context),
        'later_release_id': _ => de_Document(_, context),
        'new_release_id': _ => de_Document(_, context),
        'reconciled_keys': smithy_client_1._json,
        'release_id': smithy_client_1.expectString,
        'rolled_back_to_package_version': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_RollbackReleaseCommand = de_RollbackReleaseCommand;
const de_ServeReleaseCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'blocked_package_versions': smithy_client_1._json,
        'config': _ => de_GetReleaseConfig(_, context),
        'package': smithy_client_1._json,
        'resources': _ => de_Document(_, context),
        'telemetry': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ServeReleaseCommand = de_ServeReleaseCommand;
const de_ServeReleaseV2Command = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'blocked_package_versions': smithy_client_1._json,
        'config': _ => de_GetReleaseConfig(_, context),
        'package': smithy_client_1._json,
        'resources': _ => de_Document(_, context),
        'telemetry': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_ServeReleaseV2Command = de_ServeReleaseV2Command;
const de_UpdateControlCenterApprovalPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checkers': smithy_client_1._json,
        'emergency_rollback': smithy_client_1.expectBoolean,
        'enabled': smithy_client_1.expectBoolean,
        'makers': smithy_client_1._json,
        'request_ttl_hours': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UpdateControlCenterApprovalPolicyCommand = de_UpdateControlCenterApprovalPolicyCommand;
const de_UpdateControlCenterGroupCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'id': smithy_client_1.expectString,
        'members': smithy_client_1._json,
        'name': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UpdateControlCenterGroupCommand = de_UpdateControlCenterGroupCommand;
const de_UpdateDimensionCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'change_reason': smithy_client_1.expectString,
        'description': _ => de_Document(_, context),
        'dimension': smithy_client_1.expectString,
        'mandatory': smithy_client_1.expectBoolean,
        'position': smithy_client_1.expectInt32,
        'schema': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UpdateDimensionCommand = de_UpdateDimensionCommand;
const de_UpdateFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': _ => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UpdateFileCommand = de_UpdateFileCommand;
const de_UploadFileCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, smithy_client_1.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0, smithy_client_1.expectNonNull)(((0, smithy_client_1.expectObject)(await (0, core_1.parseJsonBody)(output.body, context))), "body");
    const doc = (0, smithy_client_1.take)(data, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': _ => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
    Object.assign(contents, doc);
    return contents;
};
exports.de_UploadFileCommand = de_UploadFileCommand;
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await (0, core_1.parseJsonErrorBody)(output.body, context)
    };
    const errorCode = (0, core_1.loadRestJsonErrorCode)(output, parsedOutput.body);
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
const throwDefaultError = (0, smithy_client_1.withBaseException)(AirborneServiceException_1.AirborneServiceException);
const de_ApprovalRequiredErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'application': smithy_client_1.expectString,
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.ApprovalRequiredError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_BadRequestErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.BadRequestError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_ConflictErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.ConflictError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_ForbiddenErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.ForbiddenError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_InternalServerErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.InternalServerError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_NotFoundErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.NotFoundError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_ReleaseSupersededErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'current_live_release_id': _ => de_Document(_, context),
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.ReleaseSupersededError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_RollbackPartialFailureErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'replacement_release_id': _ => de_Document(_, context),
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
        'rollback_operation_id': smithy_client_1.expectString,
        'stage': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.RollbackPartialFailureError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_RollbackReplacementChangedErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'operation_id': smithy_client_1.expectString,
        'replacement_release_id': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.RollbackReplacementChangedError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_RollbackUnprocessableErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'current_live_release_id': _ => de_Document(_, context),
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.RollbackUnprocessableError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_ServiceUnavailableErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
        'request_id': smithy_client_1.expectString,
        'request_status': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.ServiceUnavailableError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_TooManyRequestsErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.TooManyRequestsError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_UnauthorizedRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'code': smithy_client_1.expectString,
        'message': smithy_client_1.expectString,
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.Unauthorized({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const de_UnresolvedOperationErrorRes = async (parsedOutput, context) => {
    const contents = (0, smithy_client_1.map)({});
    const data = parsedOutput.body;
    const doc = (0, smithy_client_1.take)(data, {
        'before': _ => de_Document(_, context),
        'code': smithy_client_1.expectString,
        'expected': _ => de_Document(_, context),
        'message': smithy_client_1.expectString,
        'operation_id': smithy_client_1.expectString,
        'own_attempt': smithy_client_1.expectBoolean,
        'upstream_org': _ => de_Document(_, context),
        'upstream_workspace': _ => de_Document(_, context),
    });
    Object.assign(contents, doc);
    const exception = new models_0_1.UnresolvedOperationError({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, smithy_client_1.decorateServiceException)(exception, parsedOutput.body);
};
const se_CreateReleaseRequestConfig = (input, context) => {
    return (0, smithy_client_1.take)(input, {
        'boot_timeout': [],
        'properties': _ => se_Document(_, context),
        'release_config_timeout': [],
    });
};
const se_CreateReleaseRequestPackage = (input, context) => {
    return (0, smithy_client_1.take)(input, {
        'important': smithy_client_1._json,
        'lazy': smithy_client_1._json,
        'properties': _ => se_Document(_, context),
    });
};
const se_DeploymentRequestInputPayload = (input, context) => {
    return (0, smithy_client_1.take)(input, {
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
    return (0, smithy_client_1.take)(output, {
        'tenant_info': (_) => de_Document(_, context),
    });
};
const de_ControlCenterActiveRelease = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'created_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseRfc3339DateTimeWithOffset)(_)),
        'created_by': smithy_client_1.expectString,
        'dimensions': (_) => de_Document(_, context),
        'experimental_variant': smithy_client_1.expectString,
        'package_version': smithy_client_1.expectLong,
        'release_id': smithy_client_1.expectString,
        'status': smithy_client_1.expectString,
        'traffic_percentage': smithy_client_1.expectInt32,
    });
};
const de_ControlCenterActiveReleaseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterActiveRelease(entry, context);
    });
    return retVal;
};
const de_ControlCenterAppStatus = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'active': (_) => de_ControlCenterActiveReleaseList(_, context),
        'application': smithy_client_1.expectString,
        'approval_required': smithy_client_1.expectBoolean,
        'auxiliary_error': smithy_client_1.expectString,
        'cache_invalidation': (_) => de_Document(_, context),
        'emergency_needs_review': (_) => de_EmergencyReviewList(_, context),
        'error': (_) => de_Document(_, context),
        'last_activity_at': (_) => de_Document(_, context),
        'live': (_) => de_ControlCenterLiveReleaseList(_, context),
        'pending_requests': smithy_client_1.expectInt32,
        'platform': (_) => de_Document(_, context),
        'release_protections': (_) => de_ReleaseProtectionList(_, context),
        'serving_policy': smithy_client_1._json,
        'telemetry': (_) => de_Document(_, context),
        'unresolved_operations': smithy_client_1._json,
    });
};
const de_ControlCenterAppStatusList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterAppStatus(entry, context);
    });
    return retVal;
};
const de_ControlCenterDeploymentRequest = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'action': smithy_client_1.expectString,
        'application': smithy_client_1.expectString,
        'base_state': (_) => de_Document(_, context),
        'created_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'decided_by': (_) => de_Document(_, context),
        'decision_reason': (_) => de_Document(_, context),
        'expires_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'org': smithy_client_1.expectString,
        'payload': (_) => de_DeploymentRequestPayload(_, context),
        'payload_hash': smithy_client_1.expectString,
        'reason': smithy_client_1.expectString,
        'requester': smithy_client_1.expectString,
        'result': (_) => de_Document(_, context),
        'status': smithy_client_1.expectString,
        'updated_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
    });
};
const de_ControlCenterDeploymentRequestList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterDeploymentRequest(entry, context);
    });
    return retVal;
};
const de_ControlCenterLiveRelease = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'concluded_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseRfc3339DateTimeWithOffset)(_)),
        'config_version': smithy_client_1.expectString,
        'dimensions': (_) => de_Document(_, context),
        'package_version': smithy_client_1.expectLong,
        'release_id': smithy_client_1.expectString,
    });
};
const de_ControlCenterLiveReleaseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterLiveRelease(entry, context);
    });
    return retVal;
};
const de_ControlCenterOrganisationOverview = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'groups': (_) => de_ControlCenterOverviewGroupList(_, context),
        'name': smithy_client_1.expectString,
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
    return (0, smithy_client_1.take)(output, {
        'id': smithy_client_1.expectString,
        'members': (_) => de_ControlCenterAppStatusList(_, context),
        'name': smithy_client_1.expectString,
    });
};
const de_ControlCenterOverviewGroupList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterOverviewGroup(entry, context);
    });
    return retVal;
};
const de_ControlCenterReleaseEvent = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'action': smithy_client_1.expectString,
        'actor': smithy_client_1.expectString,
        'created_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseRfc3339DateTimeWithOffset)(_)),
        'payload': (_) => de_Document(_, context),
        'synthetic': smithy_client_1.expectBoolean,
    });
};
const de_ControlCenterReleaseEventList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_ControlCenterReleaseEvent(entry, context);
    });
    return retVal;
};
const de_CreateFileResponse = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'checksum': smithy_client_1.expectString,
        'created_at': smithy_client_1.expectString,
        'file_path': smithy_client_1.expectString,
        'id': smithy_client_1.expectString,
        'metadata': (_) => de_Document(_, context),
        'size': smithy_client_1.expectInt32,
        'status': smithy_client_1.expectString,
        'tag': smithy_client_1.expectString,
        'url': smithy_client_1.expectString,
        'version': smithy_client_1.expectInt32,
    });
};
const de_DeploymentRequestPayload = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'body': (_) => de_Document(_, context),
        'release_id': smithy_client_1.expectString,
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
    return (0, smithy_client_1.take)(output, {
        'change_reason': smithy_client_1.expectString,
        'description': (_) => de_Document(_, context),
        'dimension': smithy_client_1.expectString,
        'mandatory': smithy_client_1.expectBoolean,
        'position': smithy_client_1.expectInt32,
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
    return (0, smithy_client_1.take)(output, {
        'acknowledged_by': (_) => de_Document(_, context),
        'actor': smithy_client_1.expectString,
        'confirm_sensitive_risk': smithy_client_1.expectBoolean,
        'created_at': (_) => (0, smithy_client_1.expectNonNull)((0, smithy_client_1.parseEpochTimestamp)((0, smithy_client_1.expectNumber)(_))),
        'id': smithy_client_1.expectString,
        'new_release_id': (_) => de_Document(_, context),
        'plan': (_) => de_Document(_, context),
        'reason': smithy_client_1.expectString,
        'release_id': smithy_client_1.expectString,
        'rollback_finished': smithy_client_1.expectBoolean,
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
    return (0, smithy_client_1.take)(output, {
        'boot_timeout': smithy_client_1.expectInt32,
        'properties': (_) => de_ConfigProperties(_, context),
        'release_config_timeout': smithy_client_1.expectInt32,
        'version': smithy_client_1.expectString,
    });
};
const de_GetReleaseResponse = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'config': (_) => de_GetReleaseConfig(_, context),
        'created_at': smithy_client_1.expectString,
        'dimensions': (_) => de_DimensionsMap(_, context),
        'experiment': smithy_client_1._json,
        'id': smithy_client_1.expectString,
        'package': (_) => de_ServePackage(_, context),
        'resources': smithy_client_1._json,
        'warnings': smithy_client_1._json,
    });
};
const de_GetReleaseResponseList = (output, context) => {
    const retVal = (output || []).filter((e) => e != null).map((entry) => {
        return de_GetReleaseResponse(entry, context);
    });
    return retVal;
};
const de_ReleaseProtection = (output, context) => {
    return (0, smithy_client_1.take)(output, {
        'release_id': smithy_client_1.expectString,
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
    return (0, smithy_client_1.take)(output, {
        'important': smithy_client_1._json,
        'index': smithy_client_1._json,
        'lazy': smithy_client_1._json,
        'name': smithy_client_1.expectString,
        'properties': (_) => de_Document(_, context),
        'version': smithy_client_1.expectString,
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
const collectBodyString = (streamBody, context) => (0, smithy_client_1.collectBody)(streamBody, context).then(body => context.utf8Encoder(body));
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
